export function errorHandler(error, _request, response, _next) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ message: 'Request body must contain valid JSON.' });
  }
  if (error.name === 'ValidationError') {
    return response.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return response.status(409).json({ message: 'An account with this email already exists.' });
  }

  const status = Number.isInteger(error.status)
    ? error.status
    : Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const message = status === 500 ? 'Something went wrong. Please try again.' : error.message;
  return response.status(status).json({ message });
}