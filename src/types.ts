export type LogSeverity = "error" | "warn" | "info" | "debug";

export interface TerminalLogEntry {
  id: number;
  timestamp: string;
  severity: LogSeverity;
  message: string;
  raw: string;
  source: "metro" | "expo" | "react-native" | "unknown";
  stackTrace?: string;
  isNativeCrash?: boolean;
}

export interface ReactotronLogEntry {
  id: number;
  timestamp: string;
  type:
    | "log"
    | "api"
    | "state"
    | "asyncStorage"
    | "benchmark"
    | "custom"
    | "display";
  name?: string;
  payload: unknown;
  important?: boolean;
  duration?: number;
}

export interface ApiCallEntry {
  id: number;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
}

export interface StateChangeEntry {
  id: number;
  timestamp: string;
  store: string;
  action: string;
  path?: string;
  before?: unknown;
  after?: unknown;
}

export interface PerformanceEntry {
  id: number;
  timestamp: string;
  title: string;
  duration: number;
  steps?: { title: string; duration: number }[];
}

// --- Fase 2: Hermes/CDP types ---

export interface HermesLogEntry {
  id: number;
  timestamp: string;
  level: LogSeverity;
  message: string;
  args?: unknown[];
  stackTrace?: string;
  source: "hermes";
  url?: string;
  lineNumber?: number;
}

export interface NetworkEntry {
  id: number;
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  status?: number;
  mimeType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  duration?: number;
  source: "cdp";
}

// --- Fase 3/4: Crash types ---

export interface CrashLogEntry {
  id: number;
  timestamp: string;
  platform: "ios" | "android";
  processName: string;
  crashReason: string;
  exceptionType?: string;
  signal?: string;
  stackTrace: string;
  rawFilePath?: string;
}

export interface AppStatus {
  metroRunning: boolean;
  reactotronConnected: boolean;
  hermesConnected: boolean;
  detectedProcess: string | null;
  errorCount: number;
  warningCount: number;
  lastCrash: TerminalLogEntry | CrashLogEntry | null;
  uptime: number;
  terminalLogCount: number;
  reactotronLogCount: number;
  hermesLogCount: number;
  networkCallCount: number;
  crashCount: number;
  iosCrashMonitorActive: boolean;
  androidCrashMonitorActive: boolean;
}

export interface CompanionConfig {
  reactotronPort: number;
  terminalLogBufferSize: number;
  reactotronLogBufferSize: number;
  autoDetectTerminal: boolean;
  watchPaths: string[];
  filterPatterns: string[];
  // Fase 1: Persistence
  persistLogs: boolean;
  persistPath: string;
  persistFlushIntervalMs: number;
  persistMaxEntriesOnLoad: number;
  // Fase 2: Hermes/CDP
  hermesEnabled: boolean;
  metroPort: number;
  cdpCaptureNetwork: boolean;
  // Fase 3: iOS crash monitor
  iosCrashMonitorEnabled: boolean;
  iosCrashReportPath: string;
  // Fase 4: Android crash monitor
  androidCrashMonitorEnabled: boolean;
  adbPath: string;
}
