/**
 * API Contracts Package (skeleton)
 *
 * G05+ will populate with JSON Schema definitions, OpenAPI types,
 * and generated frontend types.
 */

export const API_PREFIX = "/api/v1" as const;

// TODO(G05): error envelope type
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}
