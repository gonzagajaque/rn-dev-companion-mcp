import { LogStore } from "../storage/log-store.js";
import { TerminalMonitor } from "../monitors/terminal.js";
import { ReactotronMonitor } from "../monitors/reactotron.js";
import { HermesMonitor } from "../monitors/hermes.js";
import { IOSCrashMonitor } from "../monitors/crash-ios.js";
import { AndroidCrashMonitor } from "../monitors/crash-android.js";
import { AppStatus } from "../types.js";

export interface StatusMonitors {
  terminalMonitor: TerminalMonitor;
  reactotronMonitor: ReactotronMonitor;
  hermesMonitor: HermesMonitor | null;
  iosCrashMonitor: IOSCrashMonitor | null;
  androidCrashMonitor: AndroidCrashMonitor | null;
}

export function handleGetStatus(
  store: LogStore,
  monitors: StatusMonitors,
  startTime: number
) {
  const errorCount = store.terminalLogs.filter(
    (l) => l.severity === "error"
  ).length;
  const warningCount = store.terminalLogs.filter(
    (l) => l.severity === "warn"
  ).length;

  const status: AppStatus = {
    metroRunning: monitors.terminalMonitor.isRunning,
    reactotronConnected: monitors.reactotronMonitor.isConnected,
    hermesConnected: monitors.hermesMonitor?.isConnected ?? false,
    detectedProcess: monitors.terminalMonitor.processName,
    errorCount,
    warningCount,
    lastCrash: store.getLastCrash(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    terminalLogCount: store.terminalLogs.count(),
    reactotronLogCount: store.reactotronLogs.count(),
    hermesLogCount: store.hermesLogs.count(),
    networkCallCount: store.networkCalls.count(),
    crashCount: store.crashLogs.count(),
    iosCrashMonitorActive: monitors.iosCrashMonitor?.isActive ?? false,
    androidCrashMonitorActive: monitors.androidCrashMonitor?.isActive ?? false,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `## RN Dev Companion Status`,
          ``,
          `- **Metro/Expo running:** ${status.metroRunning ? `Yes (${status.detectedProcess})` : "No"}`,
          `- **Reactotron connected:** ${status.reactotronConnected ? "Yes" : "No"}`,
          `- **Hermes/CDP connected:** ${status.hermesConnected ? "Yes" : "No"}`,
          `- **Errors:** ${status.errorCount}`,
          `- **Warnings:** ${status.warningCount}`,
          `- **Terminal logs:** ${status.terminalLogCount}`,
          `- **Reactotron logs:** ${status.reactotronLogCount}`,
          `- **Hermes logs:** ${status.hermesLogCount}`,
          `- **Network calls:** ${status.networkCallCount}`,
          `- **Native crashes:** ${status.crashCount}`,
          `- **iOS crash monitor:** ${status.iosCrashMonitorActive ? "Active" : "Inactive"}`,
          `- **Android crash monitor:** ${status.androidCrashMonitorActive ? "Active" : "Inactive"}`,
          `- **Uptime:** ${status.uptime}s`,
          status.lastCrash
            ? `- **Last crash:** [${status.lastCrash.timestamp}] ${"message" in status.lastCrash ? status.lastCrash.message : status.lastCrash.crashReason}`
            : `- **Last crash:** None`,
        ].join("\n"),
      },
    ],
  };
}
