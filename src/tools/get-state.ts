import { LogStore } from "../storage/log-store.js";

export function handleGetStateChanges(
  store: LogStore,
  args: { store_name?: string }
) {
  let changes = store.stateChanges.getAll();

  if (args.store_name) {
    const regex = new RegExp(args.store_name, "i");
    changes = changes.filter((c) => regex.test(c.store) || regex.test(c.action));
  }

  return {
    content: [
      {
        type: "text" as const,
        text: changes.length
          ? changes
              .map(
                (c) =>
                  `[${c.timestamp}] [${c.store}] Action: ${c.action}${c.path ? ` | Path: ${c.path}` : ""}\nBefore: ${JSON.stringify(c.before, null, 2)}\nAfter: ${JSON.stringify(c.after, null, 2)}`
              )
              .join("\n\n---\n\n")
          : "No state changes captured yet.",
      },
    ],
  };
}
