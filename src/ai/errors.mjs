export class AiServiceError extends Error {
  constructor(code, message, status = 500, options) { super(message, options); this.name = "AiServiceError"; this.code = code; this.status = status; }
}

export function safeProviderError(code, status = 502) {
  return new AiServiceError(code, "AI provider is unavailable or returned an invalid response", status);
}
