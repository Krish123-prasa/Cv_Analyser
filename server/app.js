const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const resumeRoutes = require("./routes/resumes");
const optimizationRoutes = require("./routes/optimizations");
const httpError = require("./utils/httpError");

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

function isLocalDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (!origin) return next();
  const sameOrigin = origin === req.protocol + "://" + req.get("host");
  if (!sameOrigin && !allowedOrigins.includes(origin) && !isLocalDevelopmentOrigin(origin)) {
    return next(httpError(403, "This origin is not allowed by the API."));
  }
  return cors({ origin, credentials: true })(req, res, next);
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "elevate-api" });
});
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/optimizations", optimizationRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

const clientBuild = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(clientBuild));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(clientBuild, "index.html"), (error) => {
    if (error) next();
  });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status || error.statusCode) || 500;
  if (status >= 500) console.error(error);
  const message = error.isOperational || status < 500
    ? error.message
    : "The request could not be completed.";
  res.status(status).json({ error: message });
});

module.exports = app;
