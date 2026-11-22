const app = require("../server/app");
const connectDatabase = require("../server/database");

module.exports = async function handler(req, res) {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
    }
    await connectDatabase();
  } catch (error) {
    console.error("Unable to prepare the Elevate API:", error.message);
    return res.status(503).json({ error: "The service is temporarily unavailable. Please try again later." });
  }

  return app(req, res);
};
