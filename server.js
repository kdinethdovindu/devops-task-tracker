const express = require("express");
const { randomUUID } = require("node:crypto");
const createPool = require("./db");

const PORT = process.env.PORT || 3000;

// Create our Express app using a database connection
function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(express.static("public"));

  // 1. Health check
  app.get("/health", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "OK" });
    } catch (error) {
      console.error("Health check failed:", error.message);
      res.status(503).json({ status: "ERROR" });
    }
  });

  // 2. Get all tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, title, done FROM tasks ORDER BY created_at DESC, id DESC",
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Get tasks failed:", error.message);
      res.status(500).json({ error: "Failed to load tasks" });
    }
  });

  // 3. Create a new task
  app.post("/api/tasks", async (req, res) => {
    const title = req.body?.title;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    try {
      const result = await db.query(
        "INSERT INTO tasks (id, title) VALUES ($1, $2) RETURNING id, title, done",
        [randomUUID(), title.trim()],
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Create task failed:", error.message);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // 4. Toggle task completion
  app.patch("/api/tasks/:id", async (req, res) => {
    const id = req.params.id;

    const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    try {
      const result = await db.query(
        "UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING id, title, done",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Update task failed:", error.message);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  return app;
}

// Only start a real server when running npm start
if (require.main === module) {
  require("dotenv").config();

  const pool = createPool();
  const app = createApp(pool);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on("SIGTERM", () => {
    server.close(async () => {
      await pool.end();
    });
  });
}

// Allow automated tests to create the app
module.exports = createApp;
