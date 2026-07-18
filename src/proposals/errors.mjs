export class ProposalServiceError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "ProposalServiceError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export function proposalError(code, message, status = 400, details) {
  return new ProposalServiceError(code, message, status, details);
}
