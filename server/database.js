const mongoose = require("mongoose");

let connectionPromise;

function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    return Promise.reject(new Error("MONGODB_URI is required."));
  }
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);

  if (!connectionPromise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

module.exports = connectDatabase;
