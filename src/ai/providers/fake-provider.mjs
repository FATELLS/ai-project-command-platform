export function createFakeProvider(handler) {
  if (typeof handler !== "function") throw new TypeError("Fake provider requires a test handler");
  return Object.freeze({ configured: true, testOnly: true, calls: [], async generate(request, context = {}) { this.calls.push(request); const value = await handler(request, context); return typeof value === "string" ? { content: value, usage: {} } : value; } });
}
