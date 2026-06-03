// Supabase Edge Function: send-push
// Deploy with: supabase functions deploy send-push
// Set secrets: supabase secrets set VAPID_PRIVATE=... VAPID_PUBLIC=... VAPID_SUBJECT=mailto:your@email.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@nyx.app';

// ── Minimal VAPID / WebPush implementation ──
async function importVapidKey(raw: string, isPrivate: boolean) {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    isPrivate ? 'pkcs8' : 'spki',
    isPrivate ? buildPkcs8(der) : buildSpki(der),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    isPrivate ? ['sign'] : ['verify']
  );
}

function buildSpki(pub: Uint8Array): Uint8Array {
  // Wrap raw 65-byte uncompressed point in SPKI header
  const header = new Uint8Array([48,89,48,19,6,7,42,134,72,206,61,2,1,6,8,42,134,72,206,61,3,1,7,3,66,0]);
  const out = new Uint8Array(header.length + pub.length);
  out.set(header); out.set(pub, header.length);
  return out;
}
function buildPkcs8(priv: Uint8Array): Uint8Array {
  const header = new Uint8Array([48,65,2,1,0,48,19,6,7,42,134,72,206,61,2,1,6,8,42,134,72,206,61,3,1,7,4,39,48,37,2,1,1,4,32]);
  const out = new Uint8Array(header.length + 32);
  out.set(header); out.set(priv.slice(-32), header.length);
  return out;
}

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function buildVapidToken(audience: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ:'JWT', alg:'ES256' })));
  const now = Math.floor(Date.now()/1000);
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now+3600, sub: VAPID_SUBJECT })));
  const signing = `${header}.${payload}`;
  const key = await importVapidKey(VAPID_PRIVATE, true);
  const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, new TextEncoder().encode(signing));
  return `${signing}.${b64url(sig)}`;
}

async function sendWebPush(endpoint: string, p256dh: string, auth: string, payload: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const token = await buildVapidToken(audience);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': `vapid t=${token},k=${VAPID_PUBLIC}`,
      'TTL': '86400',
    },
    body: new TextEncoder().encode(payload),
  });
  return res.status;
}

serve(async req => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const { recipient_id, title, body, url, sender_avatar } = await req.json();
  if (!recipient_id) return new Response('Missing recipient_id', { status: 400 });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', recipient_id);

  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  const payload = JSON.stringify({ title, body, url, senderAvatar: sender_avatar, tag: 'nyx-msg' });
  let sent = 0;

  for (const sub of subs) {
    try {
      const status = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (status === 201 || status === 200) sent++;
      // If 410 Gone, subscription expired — delete it
      if (status === 410) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    } catch {}
  }

  return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
