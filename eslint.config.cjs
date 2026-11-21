const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    files: ["server.js", "db.js", "scripts/**/*.js", "tests/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
];
