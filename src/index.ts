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
    persistPath: "~/.wiretap",
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

  // Try wiretap.config.json first, fallback to legacy rn-companion.config.json
  for (const filename of ["wiretap.config.json", "rn-companion.config.json"]) {
    try {
      const configPath = resolve(process.cwd(), filename);
      const raw = readFileSync(configPath, "utf-8");
      const userConfig = JSON.parse(raw) as Partial<CompanionConfig>;
      return { ...defaults, ...userConfig };
    } catch {
      // Config file not found, try next
    }
  }

  return defaults;
}

async function main() {
  const config = loadConfig();
  const { server, shutdown } = createCompanionServer(config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const handleShutdown = () => {
    process.stderr.write("[wiretap] Shutting down...\n");
    shutdown();
    process.exit(0);
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  process.stderr.write("[wiretap] MCP server started\n");
  process.stderr.write(
    `[wiretap] Reactotron port: ${config.reactotronPort}\n`
  );
  process.stderr.write(
    `[wiretap] Auto-detect terminal: ${config.autoDetectTerminal}\n`
  );
  process.stderr.write(
    `[wiretap] Hermes/CDP: ${config.hermesEnabled ? "enabled" : "disabled"}\n`
  );
  process.stderr.write(
    `[wiretap] Persistence: ${config.persistLogs ? "enabled" : "disabled"}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[wiretap] Fatal error: ${err}\n`);
  process.exit(1);
});
