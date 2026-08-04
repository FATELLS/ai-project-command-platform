/**
 * API Application Entry Point (skeleton)
 *
 * This is a walking skeleton — no business logic yet.
 * G05 will implement the real Fastify lifecycle.
 */

export async function startApi(): Promise<void> {
  // TODO(G03/T004): minimal health check server
  console.log("[api] skeleton ready — no server started yet");
}

// Do not auto-start; the real entry will be wired in G05
export { startApi as default };
