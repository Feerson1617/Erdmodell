const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");

const origin = "georisiko://modell";
const mime = { html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css", json: "application/json",
  webp: "image/webp", png: "image/png", woff2: "font/woff2", md: "text/plain; charset=utf-8", txt: "text/plain; charset=utf-8" };
const policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

// Only files actually shipped by Vite have a URL. Request paths never become filesystem paths.
async function assetHandler(root) {
  const files = new Map();
  async function index(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const key = prefix + entry.name, path = join(directory, entry.name);
      if (entry.isDirectory()) await index(path, key + "/");
      else if (entry.isFile()) files.set(key, path);
    }
  }
  await index(root, "/");
  return async request => {
    const url = new URL(request.url);
    const key = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = files.get(key);
    if (!["GET","HEAD"].includes(request.method)) return new Response(null, { status: 405 });
    if (url.protocol !== "georisiko:" || url.host !== "modell" || url.username || url.password || !file)
      return new Response(null, { status: 404 });
    return new Response(request.method === "HEAD" ? null : await readFile(file), { headers: {
      "Content-Type": mime[key.split(".").pop()] || "application/octet-stream",
      "Content-Security-Policy": policy, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
    } });
  };
}
module.exports = { origin, assetHandler };
