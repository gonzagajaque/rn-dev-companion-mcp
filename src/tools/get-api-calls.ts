import { LogStore } from "../storage/log-store.js";

export function handleGetApiCalls(
  store: LogStore,
  args: { endpoint_filter?: string; last_n?: number }
) {
  let calls = store.apiCalls.getAll();

  if (args.endpoint_filter) {
    const regex = new RegExp(args.endpoint_filter, "i");
    calls = calls.filter((c) => regex.test(c.url));
  }

  if (args.last_n) {
    calls = calls.slice(-args.last_n);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: calls.length
          ? calls
              .map(
                (c) =>
                  `[${c.timestamp}] ${c.method} ${c.url} → ${c.status ?? "pending"}${c.duration ? ` (${c.duration}ms)` : ""}\nRequest: ${JSON.stringify(c.requestBody, null, 2) ?? "—"}\nResponse: ${JSON.stringify(c.responseBody, null, 2) ?? "—"}`
              )
              .join("\n\n---\n\n")
          : "No API calls captured yet.",
      },
    ],
  };
}
