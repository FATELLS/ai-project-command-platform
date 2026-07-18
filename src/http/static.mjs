import { readFile } from "node:fs/promises";
import { join } from "node:path";

const contentTypes = Object.freeze({
  "/app.js": "text/javascript; charset=utf-8",
  "/styles.css": "text/css; charset=utf-8"
});

export const securityHeaders = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
});

function isApplicationRoute(pathname) {
  return pathname === "/" || pathname === "/login" || pathname === "/projects" || pathname.startsWith("/projects/");
}

export function createStaticHandler(publicDirectory) {
  return async function handleStatic(request, response, url) {
    if (request.method !== "GET" && request.method !== "HEAD") return false;
    const pathname = url.pathname;
    const isApp = isApplicationRoute(pathname);
    const fileName = isApp ? "index.html" : pathname === "/app.js" ? "app.js" : pathname === "/styles.css" ? "styles.css" : "";
    if (!fileName) return false;
    let content;
    try {
      content = await readFile(join(publicDirectory, fileName));
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    response.writeHead(200, {
      ...securityHeaders,
      "content-type": isApp ? "text/html; charset=utf-8" : contentTypes[pathname],
      "cache-control": "no-store"
    });
    response.end(request.method === "HEAD" ? undefined : content);
    return true;
  };
}
