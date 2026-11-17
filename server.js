const express = require("express");
const { randomUUID } = require("node:crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const tasks = [];

app.use(express.json());
app.use(express.static("public"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Get all tasks
app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

// Create task
app.post("/api/tasks", (req, res) => {
  const title = req.body.title?.trim();

  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "Title is required" });
  }

  const task = {
    id: randomUUID(),
    title,
    done: false,
  };

  tasks.push(task);
  res.status(201).json(task);
});

// Toggle task status
app.patch("/api/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  task.done = !task.done;
  res.json(task);
});

if (require.main === module) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}

module.exports = app;
