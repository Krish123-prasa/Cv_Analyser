const serverless = require("serverless-http");
const app = require("../../server/app");
const connectDatabase = require("../../server/database");

const expressHandler = serverless(app);
const functionPrefix = "/.netlify/functions/api";

function normalizePath(path) {
  const functionPathIndex = path.indexOf(functionPrefix);
  if (functionPathIndex !== -1) {
    return "/api" + path.slice(functionPathIndex + functionPrefix.length);
  }
  if (path === "/api" || path.startsWith("/api/")) return path;
  return "/api" + (path.startsWith("/") ? path : "/" + path);
}

exports.handler = async (event, context) => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
    }
    await connectDatabase();
  } catch (error) {
    console.error("Unable to prepare the Elevate API:", error.message);
    return {
      statusCode: 503,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "The service is temporarily unavailable. Please try again later." })
    };
  }

  return expressHandler({ ...event, path: normalizePath(event.path || "/") }, context);
};
