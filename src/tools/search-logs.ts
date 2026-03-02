import { LogStore } from "../storage/log-store.js";

export function handleSearchLogs(store: LogStore, args: { query: string }) {
  const results = store.searchAll(args.query);
  const totalResults =
    results.terminal.length +
    results.reactotron.length +
    results.hermes.length +
    results.network.length;

  const sections: string[] = [];

  if (results.terminal.length > 0) {
    sections.push(
      `### Terminal Logs (${results.terminal.length} matches)\n\n` +
        results.terminal
          .map(
            (l) =>
              `[${l.timestamp}] [${l.severity.toUpperCase()}] ${l.message}`
          )
          .join("\n")
    );
  }

  if (results.reactotron.length > 0) {
    sections.push(
      `### Reactotron Logs (${results.reactotron.length} matches)\n\n` +
        results.reactotron
          .map(
            (l) =>
              `[${l.timestamp}] [${l.type}] ${l.name ?? ""} — ${JSON.stringify(l.payload)}`
          )
          .join("\n")
    );
  }

  if (results.hermes.length > 0) {
    sections.push(
      `### Hermes/JS Logs (${results.hermes.length} matches)\n\n` +
        results.hermes
          .map(
            (l) =>
              `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`
          )
          .join("\n")
    );
  }

  if (results.network.length > 0) {
    sections.push(
      `### Network Calls (${results.network.length} matches)\n\n` +
        results.network
          .map(
            (l) =>
              `[${l.timestamp}] ${l.method} ${l.url} → ${l.status ?? "pending"}`
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
