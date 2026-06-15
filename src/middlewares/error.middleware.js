const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Server Error' : err.message,
    ...(err.code && {
      error: {
        code: err.code,
        ...(err.details && {
          details: err.details,
        }),
      },
    }),
  });
};

export default errorMiddleware;
