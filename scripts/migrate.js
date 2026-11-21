require("dotenv").config();

const { Pool } = require("pg");
const fs = require("node:fs/promises");
const path = require("node:path");

const connectionString =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Database connection URL is missing");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function migrate() {
  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Prevent two processes from migrating at the same time
    await client.query("SELECT pg_advisory_xact_lock(123456789)");

    // Create a migration history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationDir = path.join(__dirname, "../migrations");

    // Find all SQL migration files
    const files = (await fs.readdir(migrationDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const result = await client.query(
        "SELECT filename FROM schema_migrations WHERE filename = $1",
        [file],
      );

      // Skip migrations already executed
      if (result.rows.length > 0) {
        console.log(`Skipping: ${file}`);
        continue;
      }

      console.log(`Running: ${file}`);

      const sql = await fs.readFile(path.join(migrationDir, file), "utf8");

      await client.query(sql);

      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );

      console.log(`Completed: ${file}`);
    }

    await client.query("COMMIT");

    console.log("All migrations completed successfully!");
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

migrate();
