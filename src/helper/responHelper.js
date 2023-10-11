export function responHelper(res, statusCode, responseProperties = {}) {
 const response = { status: statusCode, ...responseProperties };
 return res.status(statusCode).json(response);
}