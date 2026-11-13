// SPDX-License-Identifier: GPL-3.0-only
// Serve the prebuilt website and the safe, in-memory music-room service.
const { createReadStream, statSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, resolve, sep } = require("node:path");
const { createRoomService } = require("./server/rooms.cjs");

const ROOT = resolve(__dirname, "docs");
const SITE_ROOT = resolve(__dirname, "project/build/replit-site");
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}

function fileExists(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function fileOrDirectoryExists(file) {
  try {
    const info = statSync(file);
    return info.isFile() || info.isDirectory();
  } catch {
    return false;
  }
}

function staticTarget(pathname) {
  if (pathname === "/") {
    const home = resolve(SITE_ROOT, "index.html");
    return fileExists(home) ? home : resolve(ROOT, "index.html");
  }

  // the generated site first (its pages, assets and firmware, at the root), then docs/
  const generated = resolve(SITE_ROOT, `.${pathname}`);
  if (generated.startsWith(`${SITE_ROOT}${sep}`) && fileOrDirectoryExists(generated)) {
    return generated;
  }

  const file = resolve(ROOT, `.${pathname}`);
  if (file !== ROOT && !file.startsWith(`${ROOT}${sep}`)) return null;
  return file;
}

const server = createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  // the home page is the root; the old /webapp/... links (before the pages moved to the root) go to their page
  if (pathname === "/home" || pathname === "/home/" || pathname === "/webapp/home" || pathname === "/webapp/home/") {
    res.writeHead(308, { Location: "/" }).end();
    return;
  }
  if (pathname === "/webapp" || pathname.startsWith("/webapp/")) {
    const url = new URL(req.url, "http://localhost");
    res.writeHead(308, { Location: (pathname.slice("/webapp".length) || "/") + url.search }).end();
    return;
  }

  const file = staticTarget(pathname);
  if (!file) {
    res.writeHead(404).end("Not found");
    return;
  }

  let target = file;
  try {
    if (statSync(target).isDirectory()) target = resolve(target, "index.html");
    const info = statSync(target);
    if (!info.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": extname(target) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(target).on("error", () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
createRoomService(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`BoopBox website listening on port ${port}`);
});
