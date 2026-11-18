require("dotenv").config();

const { Pool } = require("pg");
const fs = require("node:fs/promises");
const path = require("node:path");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

// Connect to Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    // Read our SQL migration file
    const sql = await fs.readFile(
      path.join(__dirname, "../migrations/001_create_tasks.sql"),
      "utf8",
    );

    // Execute SQL in PostgreSQL
    await pool.query(sql);

    console.log("Migration completed: tasks table is ready!");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
