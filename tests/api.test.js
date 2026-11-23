const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const createApp = require("../server");

// Fake database used only for automated tests
const savedTasks = [];

const fakeDb = {
  async query(sql, params = []) {
    if (sql === "SELECT 1") {
      return { rows: [{ value: 1 }] };
    }

    if (sql.startsWith("SELECT id, title, done")) {
      return { rows: [...savedTasks].reverse() };
    }

    if (sql.startsWith("INSERT INTO tasks")) {
      const task = {
        id: params[0],
        title: params[1],
        done: false,
        priority: params[2] ?? "MEDIUM",
      };

      savedTasks.push(task);

      return { rows: [task] };
    }

    if (sql.startsWith("UPDATE tasks")) {
      const task = savedTasks.find((t) => t.id === params[0]);

      if (!task) {
        return { rows: [] };
      }

      task.done = !task.done;

      return { rows: [task] };
    }

    throw new Error(`Unexpected query: ${sql}`);
  },
};

const app = createApp(fakeDb, { priorityEnabled: false });

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  return new Promise((resolve) => server.close(resolve));
});

// Test 1: Health endpoint
test("Health endpoint returns OK", async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "OK" });
});

// Test 2: Create, retrieve and complete task
test("Task API works correctly", async () => {
  // Create
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Learn DevOps" }),
  });

  assert.equal(createResponse.status, 201);

  const task = await createResponse.json();
  assert.equal(task.title, "Learn DevOps");
  assert.equal(task.done, false);

  // Retrieve
  const listResponse = await fetch(`${baseUrl}/api/tasks`);
  const tasks = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(tasks.length, 1);

  // Complete
  const updateResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: "PATCH",
  });

  const updatedTask = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updatedTask.done, true);
});

// Test 3: Reject empty task titles
test("Rejects an empty task title", async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "" }),
  });

  assert.equal(response.status, 400);
});

test("Priority feature is disabled", async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  const config = await response.json();

  assert.equal(response.status, 200);
  assert.equal(config.priorityEnabled, false);
});

test("Priority feature works when enabled", async () => {
  const enabledApp = createApp(fakeDb, {
    priorityEnabled: true,
  });

  const enabledServer = enabledApp.listen(0, "127.0.0.1");

  await new Promise((resolve) => {
    enabledServer.once("listening", resolve);
  });

  const url = `http://127.0.0.1:${enabledServer.address().port}`;

  try {
    // Check feature flag
    const configResponse = await fetch(`${url}/api/config`);
    const config = await configResponse.json();

    assert.equal(config.priorityEnabled, true);

    // Create HIGH-priority task
    const response = await fetch(`${url}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Test priority",
        priority: "HIGH",
      }),
    });

    const task = await response.json();

    assert.equal(response.status, 201);
    assert.equal(task.priority, "HIGH");

    // Reject invalid priority
    const invalidResponse = await fetch(`${url}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Invalid task",
        priority: "URGENT",
      }),
    });

    assert.equal(invalidResponse.status, 400);
  } finally {
    await new Promise((resolve) => {
      enabledServer.close(resolve);
    });
  }
});
