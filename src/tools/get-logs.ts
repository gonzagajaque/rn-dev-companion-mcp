import { LogStore } from "../storage/log-store.js";
import { LogSeverity } from "../types.js";

export function handleGetTerminalLogs(
  store: LogStore,
  args: { filter?: string; severity?: string; last_n?: number }
) {
  let logs = args.last_n
    ? store.terminalLogs.getLast(args.last_n)
    : store.terminalLogs.getAll();

  if (args.severity && args.severity !== "all") {
    const sev = args.severity as LogSeverity;
    logs = logs.filter((l) => l.severity === sev);
  }

  if (args.filter) {
    const regex = new RegExp(args.filter, "i");
    logs = logs.filter((l) => regex.test(l.message) || regex.test(l.raw));
  }

  return {
    content: [
      {
        type: "text" as const,
        text: logs.length
          ? logs
              .map(
                (l) =>
                  `[${l.timestamp}] [${l.severity.toUpperCase()}] [${l.source}] ${l.message}${l.stackTrace ? "\n" + l.stackTrace : ""}`
              )
              .join("\n\n")
          : "No terminal logs captured yet.",
      },
    ],
  };
}

export function handleGetReactotronLogs(
  store: LogStore,
  args: { type?: string; last_n?: number }
) {
  let logs = args.last_n
    ? store.reactotronLogs.getLast(args.last_n)
    : store.reactotronLogs.getAll();

  if (args.type && args.type !== "all") {
    logs = logs.filter((l) => l.type === args.type);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: logs.length
          ? logs
              .map(
                (l) =>
                  `[${l.timestamp}] [${l.type}] ${l.name ?? ""}\n${JSON.stringify(l.payload, null, 2)}`
              )
              .join("\n\n---\n\n")
          : "No Reactotron logs captured yet.",
      },
    ],
  };
}
