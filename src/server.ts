import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogStore } from "./storage/log-store.js";
import { LogPersistence } from "./storage/persistence.js";
import { TerminalMonitor } from "./monitors/terminal.js";
import { ReactotronMonitor } from "./monitors/reactotron.js";
import { HermesMonitor } from "./monitors/hermes.js";
import { IOSCrashMonitor } from "./monitors/crash-ios.js";
import { AndroidCrashMonitor } from "./monitors/crash-android.js";
import { CompanionConfig } from "./types.js";
import { handleGetTerminalLogs, handleGetReactotronLogs } from "./tools/get-logs.js";
import { handleGetErrors } from "./tools/get-errors.js";
import { handleGetApiCalls } from "./tools/get-api-calls.js";
import { handleGetStateChanges } from "./tools/get-state.js";
import { handleGetStatus, StatusMonitors } from "./tools/get-status.js";
import { handleGetPerformance } from "./tools/get-performance.js";
import { handleSearchLogs } from "./tools/search-logs.js";
import { handleClearLogs } from "./tools/clear-logs.js";
import { handleGetHermesLogs } from "./tools/get-hermes-logs.js";
import { handleGetNetworkCalls } from "./tools/get-network.js";
import { handleGetCrashes } from "./tools/get-crashes.js";

export function createCompanionServer(config: CompanionConfig) {
  const store = new LogStore(
    config.terminalLogBufferSize,
    config.reactotronLogBufferSize
  );

  // --- Persistence ---
  let persistence: LogPersistence | null = null;
  if (config.persistLogs) {
    persistence = new LogPersistence({
      persistPath: config.persistPath,
      flushIntervalMs: config.persistFlushIntervalMs,
      maxEntriesOnLoad: config.persistMaxEntriesOnLoad,
    });
    persistence.loadInto(store);
    persistence.attach(store);
  }

  // --- Monitors ---
  const terminalMonitor = new TerminalMonitor(store, config.filterPatterns);
  const reactotronMonitor = new ReactotronMonitor(store, config.reactotronPort);

  let hermesMonitor: HermesMonitor | null = null;
  if (config.hermesEnabled) {
    hermesMonitor = new HermesMonitor(
      store,
      config.metroPort,
      config.cdpCaptureNetwork
    );
  }

  let iosCrashMonitor: IOSCrashMonitor | null = null;
  if (config.iosCrashMonitorEnabled) {
    iosCrashMonitor = new IOSCrashMonitor(store, config.iosCrashReportPath);
  }

  let androidCrashMonitor: AndroidCrashMonitor | null = null;
  if (config.androidCrashMonitorEnabled) {
    androidCrashMonitor = new AndroidCrashMonitor(store, config.adbPath);
  }

  const startTime = Date.now();
  const monitors: StatusMonitors = {
    terminalMonitor,
    reactotronMonitor,
    hermesMonitor,
    iosCrashMonitor,
    androidCrashMonitor,
  };

  const server = new McpServer({
    name: "wiretap",
    version: "2.0.0",
  });

  // --- Tools ---

  server.tool(
    "get_terminal_logs",
    "Get terminal logs from Metro/Expo/React Native CLI with optional filtering",
    {
      filter: z.string().optional().describe("Regex filter for log messages"),
      severity: z
        .enum(["error", "warn", "info", "all"])
        .optional()
        .describe("Filter by severity level"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N logs"),
    },
    async (args) => handleGetTerminalLogs(store, args)
  );

  server.tool(
    "get_reactotron_logs",
    "Get Reactotron logs with optional type filtering",
    {
      type: z
        .enum(["api", "state", "log", "benchmark", "all"])
        .optional()
        .describe("Filter by log type"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N logs"),
    },
    async (args) => handleGetReactotronLogs(store, args)
  );

  server.tool(
    "get_errors",
    "Get consolidated errors and crashes from terminal, Reactotron, and Hermes with optional filtering",
    {
      source: z
        .enum(["terminal", "reactotron", "hermes", "all"])
        .optional()
        .describe("Filter by error source"),
      filter: z
        .string()
        .optional()
        .describe("Regex filter for error messages"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N errors"),
    },
    async (args) => handleGetErrors(store, args)
  );

  server.tool(
    "get_api_calls",
    "Get API calls captured by Reactotron with optional endpoint filtering",
    {
      endpoint_filter: z
        .string()
        .optional()
        .describe("Regex filter for API endpoint URLs"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N calls"),
    },
    async (args) => handleGetApiCalls(store, args)
  );

  server.tool(
    "get_state_changes",
    "Get state changes (Redux/MobX/Zustand) captured by Reactotron",
    {
      store_name: z
        .string()
        .optional()
        .describe("Filter by store name or action"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N changes"),
    },
    async (args) => handleGetStateChanges(store, args)
  );

  server.tool(
    "get_app_status",
    "Get overall status: Metro running, Reactotron connected, Hermes connected, error/warning counts, last crash, uptime",
    {},
    async () => handleGetStatus(store, monitors, startTime)
  );

  server.tool(
    "get_performance",
    "Get performance metrics (benchmarks, render times) from Reactotron",
    {
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N entries"),
    },
    async (args) => handleGetPerformance(store, args)
  );

  server.tool(
    "search_logs",
    "Full-text search across all terminal, Reactotron, Hermes logs, network calls, and crash reports",
    {
      query: z.string().describe("Search query (regex supported)"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N results per source"),
    },
    async (args) => handleSearchLogs(store, args)
  );

  server.tool(
    "clear_logs",
    "Clear all log buffers (terminal, Reactotron, Hermes, network, API calls, state changes, performance, crashes)",
    {},
    async () => handleClearLogs(store)
  );

  server.tool(
    "get_hermes_logs",
    "Get JS runtime logs from Hermes/CDP (console.log/warn/error) with optional filtering",
    {
      level: z
        .enum(["error", "warn", "info", "debug", "all"])
        .optional()
        .describe("Filter by log level"),
      filter: z.string().optional().describe("Regex filter for log messages"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N logs"),
    },
    async (args) => handleGetHermesLogs(store, args)
  );

  server.tool(
    "get_network_calls",
    "Get HTTP network calls captured via CDP (Chrome DevTools Protocol)",
    {
      url_filter: z
        .string()
        .optional()
        .describe("Regex filter for URL"),
      status_code: z
        .number()
        .optional()
        .describe("Filter by HTTP status code"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N calls"),
    },
    async (args) => handleGetNetworkCalls(store, args)
  );

  server.tool(
    "get_native_crashes",
    "Get native crash reports from iOS (DiagnosticReports) and Android (adb logcat)",
    {
      platform: z
        .enum(["ios", "android", "all"])
        .optional()
        .describe("Filter by platform"),
      last_n: z
        .number()
        .optional()
        .describe("Return only the last N crashes"),
    },
    async (args) => handleGetCrashes(store, args)
  );

  // --- Resources ---

  server.resource(
    "status",
    "wiretap://status",
    { description: "Current connection and app status" },
    async () => {
      const result = handleGetStatus(store, monitors, startTime);
      return { contents: [{ uri: "wiretap://status", ...result.content[0] }] };
    }
  );

  server.resource(
    "errors-latest",
    "wiretap://errors/latest",
    { description: "Latest consolidated errors" },
    async () => {
      const result = handleGetErrors(store);
      return {
        contents: [
          { uri: "wiretap://errors/latest", ...result.content[0] },
        ],
      };
    }
  );

  server.resource(
    "logs-terminal",
    "wiretap://logs/terminal",
    { description: "Terminal logs stream" },
    async () => {
      const result = handleGetTerminalLogs(store, { last_n: 50 });
      return {
        contents: [
          { uri: "wiretap://logs/terminal", ...result.content[0] },
        ],
      };
    }
  );

  server.resource(
    "logs-reactotron",
    "wiretap://logs/reactotron",
    { description: "Reactotron logs stream" },
    async () => {
      const result = handleGetReactotronLogs(store, { last_n: 50 });
      return {
        contents: [
          { uri: "wiretap://logs/reactotron", ...result.content[0] },
        ],
      };
    }
  );

  server.resource(
    "logs-hermes",
    "wiretap://logs/hermes",
    { description: "Hermes/JS runtime logs" },
    async () => {
      const result = handleGetHermesLogs(store, { last_n: 50 });
      return {
        contents: [
          { uri: "wiretap://logs/hermes", ...result.content[0] },
        ],
      };
    }
  );

  // --- Start monitors ---

  terminalMonitor.start(config.autoDetectTerminal);
  reactotronMonitor.start();
  hermesMonitor?.start();
  iosCrashMonitor?.start();
  androidCrashMonitor?.start();

  // --- Shutdown ---

  const shutdown = () => {
    terminalMonitor.stop();
    reactotronMonitor.stop();
    hermesMonitor?.stop();
    iosCrashMonitor?.stop();
    androidCrashMonitor?.stop();
    persistence?.shutdown();
  };

  return { server, store, terminalMonitor, reactotronMonitor, hermesMonitor, iosCrashMonitor, androidCrashMonitor, shutdown };
}
