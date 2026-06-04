import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── VAPID helpers (correct Deno implementation) ──
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@nyx.app";

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getVapidKeys() {
  // Import private key (raw 32-byte scalar)
  const privRaw = b64urlDecode(VAPID_PRIVATE);
  const privKey = await crypto.subtle.importKey(
    "raw", privRaw,
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveKey"]
  ).catch(async () => {
    // Try as JWK
    return crypto.subtle.importKey(
      "jwk",
      { kty:"EC", crv:"P-256", d: VAPID_PRIVATE,
        x: b64urlEncode(b64urlDecode(VAPID_PUBLIC).slice(1, 33)),
        y: b64urlEncode(b64urlDecode(VAPID_PUBLIC).slice(33, 65)) },
      { name: "ECDSA", namedCurve: "P-256" },
      true, ["sign"]
    );
  });
  return privKey;
}

async function makeVapidJWT(audience: string): Promise<string> {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: now + 43200, sub: VAPID_SUBJECT
  })));
  const unsigned = `${header}.${payload}`;

  // Import as ECDSA signing key via JWK
  const pubRaw = b64urlDecode(VAPID_PUBLIC);
  const privKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC", crv: "P-256",
      d: VAPID_PRIVATE,
      x: b64urlEncode(pubRaw.slice(1, 33)),
      y: b64urlEncode(pubRaw.slice(33, 65)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${b64urlEncode(sig)}`;
}

// ── AES-GCM push encryption (RFC 8291) ──
async function encryptPayload(
  payload: string,
  clientPublicKey: string,
  clientAuth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // Import client public key
  const clientKeyRaw = b64urlDecode(clientPublicKey);
  const clientKey = await crypto.subtle.importKey(
    "raw", clientKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // Derive shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey }, serverKeyPair.privateKey, 256
  );

  const authRaw = b64urlDecode(clientAuth);

  // HKDF extract + expand (RFC 8291)
  const enc = new TextEncoder();
  const inputKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);

  const prk = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authRaw, info: enc.encode("Content-Encoding: auth\0") },
    inputKey, 256
  );

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  // Key info
  const keyInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: aes128gcm\0"),
    0x01
  ]);
  const keyBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfo }, prkKey, 128
  );

  // Nonce info
  const nonceInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
    0x01
  ]);
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey, 96
  );

  const aesKey = await crypto.subtle.importKey("raw", keyBits, "AES-GCM", false, ["encrypt"]);

  const payloadBytes = enc.encode(payload + "\x02"); // padding delimiter
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    aesKey,
    payloadBytes
  );

  return { ciphertext: new Uint8Array(ciphertext), salt, serverPublicKey: serverPublicKeyRaw };
}

async function sendPush(endpoint: string, p256dh: string, auth: string, payload: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await makeVapidJWT(audience);

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(payload, p256dh, auth);

  // Build aes128gcm content-encoding header (RFC 8188)
  const header = new Uint8Array(21 + serverPublicKey.length);
  header.set(salt, 0);                          // 16 bytes salt
  new DataView(header.buffer).setUint32(16, 4096, false); // record size
  header[20] = serverPublicKey.length;          // key id length
  header.set(serverPublicKey, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      "TTL": "86400",
      "Urgency": "high",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Push failed ${res.status}:`, text);
  }
  return res.status;
}

// ── Main handler ──
serve(async req => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { recipient_id, title, body, url, sender_avatar } = await req.json();
    if (!recipient_id) return new Response("Missing recipient_id", { status: 400 });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", recipient_id);

    if (error) { console.error("DB error:", error); return new Response("DB error", { status: 500 }); }
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), { status: 200 });

    const notification = JSON.stringify({
      title,
      body,
      icon: sender_avatar || "/favicon.svg",
      badge: "/favicon.svg",
      tag: "nyx-msg",
      url: url || "/",
      senderAvatar: sender_avatar,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        const status = await sendPush(sub.endpoint, sub.p256dh, sub.auth, notification);
        if (status === 201 || status === 200 || status === 202) sent++;
        if (status === 410 || status === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      } catch (e) {
        console.error("Push error:", e);
      }
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Handler error:", e);
    return new Response("Internal error", { status: 500 });
  }
});
