import { LogStore } from "../storage/log-store.js";

export function handleSearchLogs(
  store: LogStore,
  args: { query: string; last_n?: number }
) {
  const results = store.searchAll(args.query);
  const totalResults =
    results.terminal.length +
    results.reactotron.length +
    results.hermes.length +
    results.network.length +
    results.crashes.length;

  const sections: string[] = [];

  if (results.terminal.length > 0) {
    const items = args.last_n
      ? results.terminal.slice(-args.last_n)
      : results.terminal;
    sections.push(
      `### Terminal Logs (${results.terminal.length} matches)\n\n` +
        items
          .map(
            (l) =>
              `[${l.timestamp}] [${l.severity.toUpperCase()}] ${l.message}`
          )
          .join("\n")
    );
  }

  if (results.reactotron.length > 0) {
    const items = args.last_n
      ? results.reactotron.slice(-args.last_n)
      : results.reactotron;
    sections.push(
      `### Reactotron Logs (${results.reactotron.length} matches)\n\n` +
        items
          .map(
            (l) =>
              `[${l.timestamp}] [${l.type}] ${l.name ?? ""} — ${JSON.stringify(l.payload)}`
          )
          .join("\n")
    );
  }

  if (results.hermes.length > 0) {
    const items = args.last_n
      ? results.hermes.slice(-args.last_n)
      : results.hermes;
    sections.push(
      `### Hermes/JS Logs (${results.hermes.length} matches)\n\n` +
        items
          .map(
            (l) =>
              `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`
          )
          .join("\n")
    );
  }

  if (results.network.length > 0) {
    const items = args.last_n
      ? results.network.slice(-args.last_n)
      : results.network;
    sections.push(
      `### Network Calls (${results.network.length} matches)\n\n` +
        items
          .map(
            (l) =>
              `[${l.timestamp}] ${l.method} ${l.url} → ${l.status ?? "pending"}`
          )
          .join("\n")
    );
  }

  if (results.crashes.length > 0) {
    const items = args.last_n
      ? results.crashes.slice(-args.last_n)
      : results.crashes;
    sections.push(
      `### Native Crashes (${results.crashes.length} matches)\n\n` +
        items
          .map(
            (l) =>
              `[${l.timestamp}] [${l.platform.toUpperCase()}] ${l.processName}: ${l.crashReason}`
          )
          .join("\n")
    );
  }

  return {
    content: [
      {
        type: "text" as const,
        text: totalResults
          ? `Found ${totalResults} results for "${args.query}":\n\n${sections.join("\n\n---\n\n")}`
          : `No results found for "${args.query}".`,
      },
    ],
  };
}
