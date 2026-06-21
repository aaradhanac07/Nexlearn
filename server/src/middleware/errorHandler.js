export const errorHandler = (err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500
  const isDev = process.env.NODE_ENV === 'development'
  console.error(`[${new Date().toISOString()}] ${status} ${req.method} ${req.path}`, err.message)
  res.status(status).json({
    error: err.name ?? 'InternalServerError',
    message: err.message ?? 'Something went wrong',
    ...(isDev && { stack: err.stack }),
  })
}