import { LogStore } from "../storage/log-store.js";
import { NetworkEntry } from "../types.js";

export function handleGetNetworkCalls(
  store: LogStore,
  args: { url_filter?: string; status_code?: number; last_n?: number }
) {
  let calls: NetworkEntry[] = store.networkCalls.getAll();

  if (args.url_filter) {
    const regex = new RegExp(args.url_filter, "i");
    calls = calls.filter((c) => regex.test(c.url));
  }

  if (args.status_code !== undefined) {
    calls = calls.filter((c) => c.status === args.status_code);
  }

  if (args.last_n) {
    calls = calls.slice(-args.last_n);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: calls.length
          ? `### Network Calls (${calls.length} entries)\n\n` +
            calls
              .map((c) => {
                const status = c.status ? ` → ${c.status}` : " → pending";
                const dur = c.duration !== undefined ? ` (${c.duration}ms)` : "";
                const mime = c.mimeType ? ` [${c.mimeType}]` : "";
                return `[${c.timestamp}] ${c.method} ${c.url}${status}${dur}${mime}`;
              })
              .join("\n")
          : "No network calls captured. Make sure CDP network capture is enabled and the app is running.",
      },
    ],
  };
}
