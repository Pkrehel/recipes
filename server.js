require("dotenv").config();
const mongoose = require("mongoose");

const databaseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/recipes";
const port = process.env.PORT || 3000;

async function start() {
  await mongoose.connect(databaseUri);
  console.log("Database connected");

  // app.js reads the mongoose client for the session store, so require it after connecting.
  const app = require("./app");
  const server = app.listen(port, () => console.log(`Server listening on port ${port}`));

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
