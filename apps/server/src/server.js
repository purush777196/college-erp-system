const dns = require("node:dns");

// Work around the current Windows DNS SRV resolution issue.
dns.setServers(["8.8.8.8", "1.1.1.1"]);


const app = require("./app");
const env = require("./config/env");
const { connectDB, closeDB } = require("./config/db");
const logger = require("./utils/logger");

let server;
let shuttingDown = false;

async function startServer() {
  try {
    // Connect to MongoDB before accepting API requests.
    await connectDB();

    logger.info("MongoDB connected successfully");

    server = app.listen(env.PORT, () => {
      logger.info("===================================================");
      logger.info(" College ERP Backend Service");
      logger.info(` Environment: ${env.NODE_ENV}`);
      logger.info(` Port:        ${env.PORT}`);
      logger.info(` Health API:  http://localhost:${env.PORT}/api/health`);
      logger.info("===================================================");
    });

    server.on("error", (error) => {
      logger.error("HTTP server error:", error);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Promise Rejection:", reason);
    });

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      shutdown("uncaughtException", 1);
    });

    process.on("SIGTERM", () => shutdown("SIGTERM", 0));
    process.on("SIGINT", () => shutdown("SIGINT", 0));

    return server;
  } catch (error) {
    logger.error("Failed to connect to MongoDB or start server:", error);
    process.exitCode = 1;
    return null;
  }
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received: closing HTTP server and database...`);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await closeDB();
    logger.info("Server gracefully terminated.");
  } catch (error) {
    logger.error("Error during server shutdown:", error);
    process.exitCode = 1;
    return;
  }

  process.exitCode = exitCode;
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;
