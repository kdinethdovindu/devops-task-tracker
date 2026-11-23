const express = require("express");
const { randomUUID } = require("node:crypto");
const createPool = require("./db");

const PORT = process.env.PORT || 3000;

function createApp(db, options = {}) {
  const app = express();

  // Feature flag: OFF by default
  const priorityEnabled =
    options.priorityEnabled ?? process.env.ENABLE_TASK_PRIORITY === "true";

  app.use(express.json());
  app.use(express.static("public"));

  // Tell frontend whether priority is enabled
  app.get("/api/config", (req, res) => {
    res.json({ priorityEnabled });
  });

  // Health check
  app.get("/health", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "OK" });
    } catch (error) {
      console.error(error.message);
      res.status(503).json({ status: "ERROR" });
    }
  });

  // Get tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const result = await db.query(
        "SELECT id, title, done, priority FROM tasks ORDER BY created_at DESC, id DESC",
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: "Failed to load tasks" });
    }
  });

  // Create task
  app.post("/api/tasks", async (req, res) => {
    const title = req.body?.title;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    // Only accept selected priority when enabled
    const priority = priorityEnabled
      ? (req.body?.priority ?? "MEDIUM")
      : "MEDIUM";

    const allowed = ["LOW", "MEDIUM", "HIGH"];

    if (!allowed.includes(priority)) {
      return res.status(400).json({
        error: "Invalid priority",
      });
    }

    try {
      const result = await db.query(
        `INSERT INTO tasks (id, title, priority)
         VALUES ($1, $2, $3)
         RETURNING id, title, done, priority`,
        [randomUUID(), title.trim(), priority],
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Toggle completion
  app.patch("/api/tasks/:id", async (req, res) => {
    const id = req.params.id;
    const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({
        error: "Invalid task ID",
      });
    }

    try {
      const result = await db.query(
        `UPDATE tasks SET done = NOT done
         WHERE id = $1
         RETURNING id, title, done, priority`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  return app;
}

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

module.exports = createApp;
