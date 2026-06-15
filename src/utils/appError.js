class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'SERVER_ERROR',
    details = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export default AppError;
