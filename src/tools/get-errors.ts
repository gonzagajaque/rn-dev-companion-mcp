import { LogStore } from "../storage/log-store.js";

export function handleGetErrors(store: LogStore) {
  const errors = store.getErrors();

  return {
    content: [
      {
        type: "text" as const,
        text: errors.length
          ? errors
              .map((e) => {
                if ("severity" in e && "raw" in e) {
                  return `[TERMINAL] [${e.timestamp}] ${e.message}${e.stackTrace ? "\n" + e.stackTrace : ""}`;
                }
                if ("source" in e && e.source === "hermes") {
                  return `[HERMES] [${e.timestamp}] [${e.level.toUpperCase()}] ${e.message}${e.stackTrace ? "\n" + e.stackTrace : ""}`;
                }
                return `[REACTOTRON] [${e.timestamp}] [${(e as { type: string }).type}] ${(e as { name?: string }).name ?? ""}\n${JSON.stringify((e as { payload: unknown }).payload, null, 2)}`;
              })
              .join("\n\n---\n\n")
          : "No errors detected.",
      },
    ],
  };
}
