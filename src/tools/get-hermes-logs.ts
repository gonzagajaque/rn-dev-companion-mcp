import { LogStore } from "../storage/log-store.js";
import { HermesLogEntry, LogSeverity } from "../types.js";

export function handleGetHermesLogs(
  store: LogStore,
  args: { level?: string; filter?: string; last_n?: number }
) {
  let logs: HermesLogEntry[];

  if (args.level && args.level !== "all") {
    logs = store.hermesLogs.filter((l) => l.level === (args.level as LogSeverity));
  } else {
    logs = store.hermesLogs.getAll();
  }

  if (args.filter) {
    const regex = new RegExp(args.filter, "i");
    logs = logs.filter((l) => regex.test(l.message));
  }

  if (args.last_n) {
    logs = logs.slice(-args.last_n);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: logs.length
          ? `### Hermes/JS Logs (${logs.length} entries)\n\n` +
            logs
              .map(
                (l) =>
                  `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.stackTrace ? "\n" + l.stackTrace : ""}`
              )
              .join("\n")
          : "No Hermes logs captured. Make sure the app is running with Hermes and Metro debugger is accessible.",
      },
    ],
  };
}
