require("dotenv").config();

const app = require("./app");
const connectDatabase = require("./database");

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  await connectDatabase();
  app.listen(port, () => {
    console.log("Elevate API listening on http://localhost:" + port);
  });
}

start().catch((error) => {
  console.error("Unable to start Elevate:", error.message);
  process.exitCode = 1;
});
