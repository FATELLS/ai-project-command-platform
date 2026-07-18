export class ReviewServiceError extends Error {
  constructor(status,code,message,details={}){super(message);this.name="ReviewServiceError";this.status=status;this.code=code;this.details=details;}
}
export function reviewError(code,message,status=400,details={}){return new ReviewServiceError(status,code,message,details);}
