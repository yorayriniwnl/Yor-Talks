"use strict";

const { spawn, spawnSync } = require("node:child_process");

const children = [];
let shuttingDown = false;
const shutdownAfterMs = Number.parseInt(process.env.DEV_SHUTDOWN_AFTER_MS || "", 10);

function color(code, text) {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function prefixStream(child, streamName, label, colorCode) {
  const stream = child[streamName];
  const output = streamName === "stderr" ? process.stderr : process.stdout;
  const prefix = `${color(colorCode, `[${label}]`)} `;
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      output.write(`${prefix}${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer) output.write(`${prefix}${buffer}\n`);
  });
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) stopChild(child);

  setTimeout(() => process.exit(exitCode), 250).unref();
}

function start(label, prefixPath, colorCode) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm run dev --prefix ${prefixPath}`]
    : ["run", "dev", "--prefix", prefixPath];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  children.push(child);
  prefixStream(child, "stdout", label, colorCode);
  prefixStream(child, "stderr", label, colorCode);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    const exitCode = typeof code === "number" ? code : signal ? 1 : 0;
    if (exitCode !== 0) {
      process.stderr.write(`${color(colorCode, `[${label}]`)} exited with code ${exitCode}\n`);
    }
    shutdown(exitCode);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    process.stderr.write(`${color(colorCode, `[${label}]`)} ${error.message}\n`);
    shutdown(1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (Number.isFinite(shutdownAfterMs) && shutdownAfterMs > 0) {
  setTimeout(() => shutdown(0), shutdownAfterMs).unref();
}

start("API", "backend", "35");
start("WEB", "frontend", "36");
