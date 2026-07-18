import { AiServiceError } from "../errors.mjs";
export function createDisabledProvider() { return Object.freeze({ configured: false, async generate() { throw new AiServiceError("AI_PROVIDER_DISABLED", "AI provider is not configured", 503); } }); }
