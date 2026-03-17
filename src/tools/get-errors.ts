import { LogStore } from "../storage/log-store.js";

export function handleGetErrors(
  store: LogStore,
  args: {
    source?: "terminal" | "reactotron" | "hermes" | "all";
    filter?: string;
    last_n?: number;
  } = {}
) {
  let errors = store.getErrors();

  const source = args.source ?? "all";
  if (source !== "all") {
    errors = errors.filter((e) => {
      if (source === "terminal") return "severity" in e && "raw" in e;
      if (source === "hermes") return "source" in e && e.source === "hermes";
      if (source === "reactotron")
        return "type" in e && !("severity" in e) && !("level" in e);
      return true;
    });
  }

  if (args.filter) {
    const regex = new RegExp(args.filter, "i");
    errors = errors.filter((e) => {
      if ("message" in e) return regex.test((e as { message: string }).message);
      if ("name" in e) return regex.test((e as { name: string }).name ?? "");
      return regex.test(JSON.stringify(e));
    });
  }

  if (args.last_n) {
    errors = errors.slice(-args.last_n);
  }

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
