import { LogStore } from "../storage/log-store.js";

export function handleClearLogs(store: LogStore) {
  store.clearAll();

  return {
    content: [
      {
        type: "text" as const,
        text: "All log buffers cleared successfully.",
      },
    ],
  };
}
