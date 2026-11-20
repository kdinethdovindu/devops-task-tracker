const { Pool } = require("pg");

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Check your .env file.");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

module.exports = createPool;
