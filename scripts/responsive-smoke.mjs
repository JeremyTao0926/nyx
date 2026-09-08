import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const baseUrl = process.env.NYX_QA_URL || "http://127.0.0.1:4173";
const outputDir = resolve("qa-artifacts", "responsive-smoke");
mkdirSync(outputDir, { recursive: true });

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chromePath = candidates.find(existsSync);
if (!chromePath) throw new Error("Chrome/Edge not found. Set CHROME_PATH and retry.");

const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const profileDir = mkdtempSync(join(tmpdir(), "nyx-responsive-"));
const browser = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore" });

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", rejectReady, { once: true });
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

async function connect() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = pages.find(item => item.type === "page");
      if (page?.webSocketDebuggerUrl) return new CdpClient(page.webSocketDebuggerUrl);
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Timed out connecting to headless Chrome");
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result.value;
}

const viewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-8", width: 375, height: 667 },
  { name: "iphone-13-mini", width: 375, height: 812 },
  { name: "iphone-15", width: 393, height: 852 },
  { name: "iphone-16-pro-max", width: 430, height: 932 },
  { name: "keyboard-stress", width: 375, height: 420 },
];

const client = await connect();
const browserErrors = [];
client.on("Runtime.exceptionThrown", event => {
  browserErrors.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "Uncaught exception");
});
client.on("Log.entryAdded", event => {
  if (["error", "warning"].includes(event.entry?.level)) browserErrors.push(`${event.entry.level}: ${event.entry.text}`);
});

const report = [];
let failed = false;
try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");

  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    const errorStart = browserErrors.length;
    const url = `${baseUrl}/?auth-screen=login&auth-preview=1&qa=${viewport.name}`;
    await client.send("Page.navigate", { url });
    await delay(1800);

    const metrics = await evaluate(client, `(() => {
      const root = document.getElementById("root");
      const shell = document.querySelector(".nyx-auth-shell");
      const text = document.body.innerText;
      const horizontallyClipped = [...document.querySelectorAll("button, input, a")]
        .filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
        })
        .map(node => (node.textContent || node.getAttribute("placeholder") || node.tagName).trim().slice(0, 60));
      return {
        title: document.title,
        innerWidth,
        innerHeight,
        rootHeight: root?.getBoundingClientRect().height || 0,
        shellHeight: shell?.getBoundingClientRect().height || 0,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
        horizontallyClipped,
        hasLogin: text.includes("歡迎回來") && text.includes("電郵／用戶名登入"),
        hasSocialOptions: text.includes("使用 Google 繼續") && text.includes("使用 Apple 繼續") && text.includes("使用手機號碼繼續"),
      };
    })()`);

    const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(join(outputDir, `${viewport.name}.png`), Buffer.from(screenshot.data, "base64"));
    const errors = browserErrors.slice(errorStart);
    const passed = !metrics.horizontalOverflow
      && metrics.horizontallyClipped.length === 0
      && metrics.rootHeight >= viewport.height - 1
      && metrics.shellHeight >= viewport.height - 1
      && metrics.hasLogin
      && metrics.hasSocialOptions
      && errors.length === 0;
    if (!passed) failed = true;
    report.push({ ...viewport, passed, metrics, errors });
  }

  for (const pageName of ["privacy", "terms", "support"]) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 568,
      deviceScaleFactor: 3,
      mobile: true,
      screenWidth: 320,
      screenHeight: 568,
    });
    const errorStart = browserErrors.length;
    await client.send("Page.navigate", { url: `${baseUrl}/${pageName}.html` });
    await delay(500);
    const metrics = await evaluate(client, `({
      title: document.title,
      textLength: document.body.innerText.trim().length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
    })`);
    const errors = browserErrors.slice(errorStart);
    const passed = !metrics.horizontalOverflow && metrics.textLength > 150 && errors.length === 0;
    if (!passed) failed = true;
    report.push({ name: pageName, width: 320, height: 568, passed, metrics, errors });
  }

  const reportPath = join(outputDir, "report.json");
  writeFileSync(reportPath, JSON.stringify({ baseUrl, browser: basename(chromePath), report }, null, 2));
  console.log(JSON.stringify({ passed: !failed, reportPath, cases: report.map(item => ({ name: item.name, passed: item.passed })) }, null, 2));
} finally {
  client.close();
  browser.kill();
  await Promise.race([
    new Promise(resolveExit => browser.once("exit", resolveExit)),
    delay(1500),
  ]);
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  } catch (error) {
    console.warn(`Unable to remove temporary browser profile: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) process.exitCode = 1;
