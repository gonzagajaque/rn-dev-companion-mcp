import { LogStore } from "../storage/log-store.js";
import { CrashLogEntry } from "../types.js";

export function handleGetCrashes(
  store: LogStore,
  args: { platform?: string; last_n?: number }
) {
  let crashes: CrashLogEntry[] = store.crashLogs.getAll();

  if (args.platform && args.platform !== "all") {
    crashes = crashes.filter(
      (c) => c.platform === (args.platform as "ios" | "android")
    );
  }

  if (args.last_n) {
    crashes = crashes.slice(-args.last_n);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: crashes.length
          ? `### Native Crashes (${crashes.length} entries)\n\n` +
            crashes
              .map((c) => {
                const header = `[${c.timestamp}] [${c.platform.toUpperCase()}] ${c.processName}`;
                const reason = `**Reason:** ${c.crashReason}`;
                const exType = c.exceptionType
                  ? `**Exception:** ${c.exceptionType}`
                  : "";
                const sig = c.signal ? `**Signal:** ${c.signal}` : "";
                const file = c.rawFilePath
                  ? `**File:** ${c.rawFilePath}`
                  : "";
                const stack = c.stackTrace
                  ? `\`\`\`\n${c.stackTrace}\n\`\`\``
                  : "";

                return [header, reason, exType, sig, file, stack]
                  .filter(Boolean)
                  .join("\n");
              })
              .join("\n\n---\n\n")
          : "No native crashes captured.",
      },
    ],
  };
}
