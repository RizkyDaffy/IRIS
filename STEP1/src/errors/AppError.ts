// §0.5 — shared error envelope used across all routes
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(requestId: string) {
    return { error: { code: this.code, message: this.message, requestId } };
  }
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', msg),
  notFound: (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg),
  badRequest: (msg: string) => new AppError(400, 'BAD_REQUEST', msg),
  tooManyRequests: () => new AppError(429, 'RATE_LIMITED', 'Rate limit exceeded'),
  internalError: (msg = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', msg),
  badGateway: (msg = 'Upstream unreachable') => new AppError(502, 'BAD_GATEWAY', msg),
  gatewayTimeout: () => new AppError(504, 'GATEWAY_TIMEOUT', 'Upstream timed out'),
  applicationNotFound: () => new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found or inactive'),
};
