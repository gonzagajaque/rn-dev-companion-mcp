import { HermesLogEntry, NetworkEntry, LogSeverity } from "../types.js";

interface CDPConsoleEvent {
  method: "Runtime.consoleAPICalled";
  params: {
    type: string;
    args: Array<{ type: string; value?: unknown; description?: string }>;
    stackTrace?: {
      callFrames: Array<{
        functionName: string;
        url: string;
        lineNumber: number;
        columnNumber: number;
      }>;
    };
  };
}

interface CDPRequestEvent {
  method: "Network.requestWillBeSent";
  params: {
    requestId: string;
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
    };
    timestamp: number;
  };
}

interface CDPResponseEvent {
  method: "Network.responseReceived";
  params: {
    requestId: string;
    response: {
      url: string;
      status: number;
      mimeType: string;
      headers: Record<string, string>;
    };
    timestamp: number;
  };
}

type CDPEvent = CDPConsoleEvent | CDPRequestEvent | CDPResponseEvent | { method: string; params?: unknown };

function mapConsoleLevel(type: string): LogSeverity {
  switch (type) {
    case "error":
      return "error";
    case "warning":
    case "warn":
      return "warn";
    case "debug":
    case "trace":
      return "debug";
    default:
      return "info";
  }
}

function stringifyArg(arg: { type: string; value?: unknown; description?: string }): string {
  if (arg.type === "string") return String(arg.value ?? arg.description ?? "");
  if (arg.type === "number" || arg.type === "boolean") return String(arg.value);
  if (arg.type === "undefined") return "undefined";
  if (arg.description !== undefined) return String(arg.description);
  if (arg.value !== undefined) {
    if (typeof arg.value === "object" && arg.value !== null) {
      try {
        return JSON.stringify(arg.value);
      } catch {
        return "[Circular]";
      }
    }
    return String(arg.value);
  }
  return `[${arg.type}]`;
}

function serializeArgValue(arg: { type: string; value?: unknown; description?: string }): unknown {
  if (arg.value !== undefined) {
    if (typeof arg.value === "object" && arg.value !== null) return arg.value;
    return arg.value;
  }
  if (arg.description !== undefined) return arg.description;
  return null;
}

export function parseCDPConsole(event: CDPConsoleEvent): Omit<HermesLogEntry, "id"> {
  const args = event.params.args || [];
  const messageParts = args.map(stringifyArg);

  const stackFrames = event.params.stackTrace?.callFrames;
  let stackTrace: string | undefined;
  let url: string | undefined;
  let lineNumber: number | undefined;

  if (stackFrames && stackFrames.length > 0) {
    url = stackFrames[0].url;
    lineNumber = stackFrames[0].lineNumber;
    stackTrace = stackFrames
      .map((f) => `  at ${f.functionName || "(anonymous)"} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
      .join("\n");
  }

  return {
    timestamp: new Date().toISOString(),
    level: mapConsoleLevel(event.params.type),
    message: messageParts.join(" "),
    args: args.map(serializeArgValue),
    stackTrace,
    source: "hermes",
    url,
    lineNumber,
  };
}

export interface PendingRequest {
  requestId: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  startTime: number;
}

export function parseCDPRequest(event: CDPRequestEvent): PendingRequest {
  return {
    requestId: event.params.requestId,
    method: event.params.request.method,
    url: event.params.request.url,
    requestHeaders: event.params.request.headers,
    startTime: event.params.timestamp,
  };
}

export function parseCDPResponse(
  event: CDPResponseEvent,
  pending: PendingRequest | undefined
): Omit<NetworkEntry, "id"> {
  const duration = pending
    ? Math.round((event.params.timestamp - pending.startTime) * 1000)
    : undefined;

  return {
    timestamp: new Date().toISOString(),
    requestId: event.params.requestId,
    method: pending?.method ?? "UNKNOWN",
    url: event.params.response.url,
    status: event.params.response.status,
    mimeType: event.params.response.mimeType,
    requestHeaders: pending?.requestHeaders,
    responseHeaders: event.params.response.headers,
    duration,
    source: "cdp",
  };
}

export function isCDPConsoleEvent(msg: CDPEvent): msg is CDPConsoleEvent {
  return msg.method === "Runtime.consoleAPICalled";
}

export function isCDPRequestEvent(msg: CDPEvent): msg is CDPRequestEvent {
  return msg.method === "Network.requestWillBeSent";
}

export function isCDPResponseEvent(msg: CDPEvent): msg is CDPResponseEvent {
  return msg.method === "Network.responseReceived";
}
