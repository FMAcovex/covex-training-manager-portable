export class AuthenticationError extends Error {
  constructor(message: string, readonly status: 401 | 403) {
    super(message);
    this.name = "AuthenticationError";
  }
}
