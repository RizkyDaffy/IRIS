export class IrisConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrisConfigError';
  }
}

export class IrisApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'IrisApiError';
  }
}
