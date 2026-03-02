#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCompanionServer } from "./server.js";
import { CompanionConfig } from "./types.js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadConfig(): CompanionConfig {
  const defaults: CompanionConfig = {
    reactotronPort: 9090,
    terminalLogBufferSize: 500,
    reactotronLogBufferSize: 500,
    autoDetectTerminal: true,
    watchPaths: [],
    filterPatterns: [],
    // Persistence
    persistLogs: false,
    persistPath: "~/.rn-dev-companion",
    persistFlushIntervalMs: 5000,
    persistMaxEntriesOnLoad: 200,
    // Hermes/CDP
    hermesEnabled: true,
    metroPort: 8081,
    cdpCaptureNetwork: true,
    // iOS crash monitor
    iosCrashMonitorEnabled: true,
    iosCrashReportPath: "~/Library/Logs/DiagnosticReports",
    // Android crash monitor
    androidCrashMonitorEnabled: true,
    adbPath: "adb",
  };

  try {
    const configPath = resolve(process.cwd(), "rn-companion.config.json");
    const raw = readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(raw) as Partial<CompanionConfig>;
    return { ...defaults, ...userConfig };
  } catch {
    // No config file found, use defaults
    return defaults;
  }
}

async function main() {
  const config = loadConfig();
  const { server, shutdown } = createCompanionServer(config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const handleShutdown = () => {
    process.stderr.write("[rn-dev-companion] Shutting down...\n");
    shutdown();
    process.exit(0);
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  process.stderr.write("[rn-dev-companion] MCP server started\n");
  process.stderr.write(
    `[rn-dev-companion] Reactotron port: ${config.reactotronPort}\n`
  );
  process.stderr.write(
    `[rn-dev-companion] Auto-detect terminal: ${config.autoDetectTerminal}\n`
  );
  process.stderr.write(
    `[rn-dev-companion] Hermes/CDP: ${config.hermesEnabled ? "enabled" : "disabled"}\n`
  );
  process.stderr.write(
    `[rn-dev-companion] Persistence: ${config.persistLogs ? "enabled" : "disabled"}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[rn-dev-companion] Fatal error: ${err}\n`);
  process.exit(1);
});
