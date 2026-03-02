import { LogStore } from "../storage/log-store.js";

export function handleGetPerformance(store: LogStore) {
  const entries = store.performanceEntries.getAll();

  return {
    content: [
      {
        type: "text" as const,
        text: entries.length
          ? entries
              .map((e) => {
                let text = `[${e.timestamp}] **${e.title}** — ${e.duration}ms`;
                if (e.steps?.length) {
                  text +=
                    "\n" +
                    e.steps
                      .map((s) => `  - ${s.title}: ${s.duration}ms`)
                      .join("\n");
                }
                return text;
              })
              .join("\n\n")
          : "No performance data captured yet.",
      },
    ],
  };
}
