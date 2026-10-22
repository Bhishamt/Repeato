#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

const PG_TEST_URL = process.env.PG_TEST_URL || "postgres://postgres@127.0.0.1:55432/repeato_test";
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";

const steps = [
  {
    name: "TypeScript Check",
    command: npmCmd,
    args: ["run", "typecheck"],
    env: process.env,
  },
  {
    name: "Ensure Local PostgreSQL Cluster",
    command: "node",
    args: ["scripts/pg.mjs", "start"],
    env: process.env,
  },
  {
    name: "PostgreSQL Database Migrations",
    command: "node",
    args: ["scripts/migrate.mjs", "--local"],
    env: { ...process.env, DATABASE_URL: PG_TEST_URL },
  },
  {
    name: "Verify Least-Privilege DB Role",
    command: "node",
    args: ["scripts/verify-db-role.mjs"],
    env: { ...process.env, ADMIN_DATABASE_URL: PG_TEST_URL },
  },
  {
    name: "Unit, Integration & Security Tests",
    command: npmCmd,
    args: ["run", "test"],
    env: { ...process.env, PG_TEST_URL },
  },
  {
    name: "Production Build",
    command: npmCmd,
    args: ["run", "build"],
    env: process.env,
  },
  {
    name: "Playwright E2E Smoke Tests",
    command: npxCmd,
    args: ["playwright", "test"],
    env: process.env,
  },
];

console.log("=================================================");
console.log("  REPEATO LOCAL CI & ACCEPTANCE TEST PIPELINE    ");
console.log("=================================================\n");

const results = [];
let allPassed = true;

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  console.log(`[${i + 1}/${steps.length}] Running: ${step.name}...`);
  const start = performance.now();
  const run = spawnSync(step.command, step.args, {
    stdio: "inherit",
    env: step.env,
    encoding: "utf8",
    shell: true,
  });
  const duration = ((performance.now() - start) / 1000).toFixed(2);

  if (run.status === 0) {
    console.log(`✓ ${step.name} passed (${duration}s)\n`);
    results.push({ name: step.name, status: "PASSED", duration: `${duration}s` });
  } else {
    console.error(`✗ ${step.name} FAILED (${duration}s)\n`);
    results.push({ name: step.name, status: "FAILED", duration: `${duration}s` });
    allPassed = false;
    break;
  }
}

console.log("\n=================================================");
console.log("  CI PIPELINE SUMMARY                            ");
console.log("=================================================");
console.table(results);

if (!allPassed) {
  console.error("Local CI failed. Correct the errors above.");
  process.exit(1);
} else {
  console.log("All local CI steps passed successfully! Ready for deployment.");
  process.exit(0);
}
