const jwt = require("jsonwebtoken");
const httpError = require("../utils/httpError");

function requireAuth(req, _res, next) {
  const token = req.cookies && req.cookies.elevate_session;
  if (!token) return next(httpError(401, "Please sign in to continue."));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch {
    return next(httpError(401, "Your session has expired. Please sign in again."));
  }
}

module.exports = requireAuth;
