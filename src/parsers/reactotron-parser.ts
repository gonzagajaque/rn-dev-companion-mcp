import {
  ReactotronLogEntry,
  ApiCallEntry,
  StateChangeEntry,
  PerformanceEntry,
} from "../types.js";

interface ReactotronMessage {
  type: string;
  payload?: Record<string, unknown>;
  important?: boolean;
  date?: string;
  deltaTime?: number;
  name?: string;
}

export function parseReactotronMessage(
  msg: ReactotronMessage
): {
  logEntry: Omit<ReactotronLogEntry, "id">;
  apiCall?: Omit<ApiCallEntry, "id">;
  stateChange?: Omit<StateChangeEntry, "id">;
  performanceEntry?: Omit<PerformanceEntry, "id">;
} {
  const timestamp = msg.date ?? new Date().toISOString();
  const type = mapReactotronType(msg.type);

  const logEntry: Omit<ReactotronLogEntry, "id"> = {
    timestamp,
    type,
    name: msg.name ?? msg.type,
    payload: msg.payload ?? {},
    important: msg.important,
    duration: msg.deltaTime,
  };

  let apiCall: Omit<ApiCallEntry, "id"> | undefined;
  let stateChange: Omit<StateChangeEntry, "id"> | undefined;
  let performanceEntry: Omit<PerformanceEntry, "id"> | undefined;

  if (type === "api" && msg.payload) {
    apiCall = parseApiCall(msg.payload, timestamp);
  }

  if (type === "state" && msg.payload) {
    stateChange = parseStateChange(msg.payload, timestamp, msg.name);
  }

  if (type === "benchmark" && msg.payload) {
    performanceEntry = parseBenchmark(msg.payload, timestamp, msg.name);
  }

  return { logEntry, apiCall, stateChange, performanceEntry };
}

function mapReactotronType(type: string): ReactotronLogEntry["type"] {
  const typeMap: Record<string, ReactotronLogEntry["type"]> = {
    "api.response": "api",
    "api.request": "api",
    "state.action.complete": "state",
    "state.values.change": "state",
    "state.values.response": "state",
    "state.backup.response": "state",
    "state.keys.response": "state",
    "asyncStorage.values.change": "asyncStorage",
    "asyncStorage.mutation": "asyncStorage",
    "benchmark.report": "benchmark",
    "display": "display",
    "log": "log",
    "client.intro": "log",
    "image": "custom",
    "custom": "custom",
  };
  return typeMap[type] ?? "log";
}

function parseApiCall(
  payload: Record<string, unknown>,
  timestamp: string
): Omit<ApiCallEntry, "id"> {
  const request = (payload.request ?? payload) as Record<string, unknown>;
  const response = (payload.response ?? {}) as Record<string, unknown>;

  return {
    timestamp,
    method: (request.method as string) ?? "GET",
    url: (request.url as string) ?? "unknown",
    status: response.status as number | undefined,
    duration: payload.duration as number | undefined,
    requestHeaders: request.headers as Record<string, string> | undefined,
    requestBody: request.data ?? request.body,
    responseHeaders: response.headers as Record<string, string> | undefined,
    responseBody: response.body ?? response.data,
  };
}

function parseStateChange(
  payload: Record<string, unknown>,
  timestamp: string,
  name?: string
): Omit<StateChangeEntry, "id"> {
  return {
    timestamp,
    store: (payload.name as string) ?? name ?? "unknown",
    action: (payload.action as string) ?? (payload.type as string) ?? "unknown",
    path: payload.path as string | undefined,
    before: payload.before,
    after: payload.after ?? payload.value,
  };
}

function parseBenchmark(
  payload: Record<string, unknown>,
  timestamp: string,
  name?: string
): Omit<PerformanceEntry, "id"> {
  const steps = payload.steps as { title: string; duration: number }[] | undefined;
  return {
    timestamp,
    title: (payload.title as string) ?? name ?? "benchmark",
    duration: (payload.duration as number) ?? 0,
    steps,
  };
}
