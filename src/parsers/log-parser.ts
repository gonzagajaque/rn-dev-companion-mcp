import { LogSeverity, TerminalLogEntry } from "../types.js";

const ERROR_PATTERNS = [
  /error/i,
  /fatal/i,
  /exception/i,
  /crash/i,
  /FAILURE/,
  /BUILD FAILED/,
  /Red ?Box/i,
  /Cannot read propert/i,
  /undefined is not/i,
  /null is not/i,
  /TypeError/,
  /ReferenceError/,
  /SyntaxError/,
  /RangeError/,
  /Invariant Violation/,
  /Native crash/i,
  /SIGABRT/,
  /SIGSEGV/,
];

const WARN_PATTERNS = [
  /warning/i,
  /warn/i,
  /deprecated/i,
  /YellowBox/i,
  /LogBox/i,
  /WARN\s/,
];

const NATIVE_CRASH_PATTERNS = [
  /Native crash/i,
  /SIGABRT/,
  /SIGSEGV/,
  /signal \d+/,
  /libc\+\+abi/,
  /NSException/,
  /java\.lang\.\w+Exception/,
  /AndroidRuntime/,
  /FATAL EXCEPTION/,
];

const STACK_TRACE_START = /^\s+at\s+|^\s+in\s+|^#\d+\s+/;

const SOURCE_PATTERNS: { pattern: RegExp; source: TerminalLogEntry["source"] }[] = [
  { pattern: /metro/i, source: "metro" },
  { pattern: /expo/i, source: "expo" },
  { pattern: /react-native/i, source: "react-native" },
];

export function parseTerminalLine(
  raw: string,
  detectedSource: TerminalLogEntry["source"] = "unknown"
): Omit<TerminalLogEntry, "id"> {
  const timestamp = new Date().toISOString();
  const trimmed = raw.trim();

  const severity = detectSeverity(trimmed);
  const isNativeCrash = NATIVE_CRASH_PATTERNS.some((p) => p.test(trimmed));
  const source = detectSource(trimmed) ?? detectedSource;
  const stackTrace = extractStackTrace(trimmed);

  const message = cleanMessage(trimmed);

  return {
    timestamp,
    severity,
    message,
    raw: trimmed,
    source,
    ...(stackTrace && { stackTrace }),
    ...(isNativeCrash && { isNativeCrash }),
  };
}

function detectSeverity(line: string): LogSeverity {
  if (ERROR_PATTERNS.some((p) => p.test(line))) return "error";
  if (WARN_PATTERNS.some((p) => p.test(line))) return "warn";
  if (/^\s*(LOG|INFO|DEBUG)\s/i.test(line)) return line.match(/DEBUG/i) ? "debug" : "info";
  return "info";
}

function detectSource(line: string): TerminalLogEntry["source"] | null {
  for (const { pattern, source } of SOURCE_PATTERNS) {
    if (pattern.test(line)) return source;
  }
  return null;
}

function extractStackTrace(line: string): string | undefined {
  const lines = line.split("\n");
  const stackLines: string[] = [];
  let inStack = false;

  for (const l of lines) {
    if (STACK_TRACE_START.test(l)) {
      inStack = true;
      stackLines.push(l.trim());
    } else if (inStack && l.trim() === "") {
      break;
    } else if (inStack) {
      stackLines.push(l.trim());
    }
  }

  return stackLines.length > 0 ? stackLines.join("\n") : undefined;
}

function cleanMessage(line: string): string {
  return line
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") // strip ANSI codes
    .replace(/^\s*\[?\d{2}:\d{2}:\d{2}\]?\s*/, "") // strip timestamps
    .trim();
}

export function shouldFilterLog(line: string, filterPatterns: string[]): boolean {
  if (!line.trim()) return true;
  return filterPatterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(line);
    } catch {
      return line.includes(pattern);
    }
  });
}

export function parseMultilineLog(
  chunk: string,
  detectedSource: TerminalLogEntry["source"] = "unknown"
): Omit<TerminalLogEntry, "id">[] {
  const lines = chunk.split("\n");
  const entries: Omit<TerminalLogEntry, "id">[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (STACK_TRACE_START.test(line) && currentBlock.length > 0) {
      currentBlock.push(line);
    } else {
      if (currentBlock.length > 0) {
        entries.push(parseTerminalLine(currentBlock.join("\n"), detectedSource));
      }
      currentBlock = [line];
    }
  }

  if (currentBlock.length > 0) {
    entries.push(parseTerminalLine(currentBlock.join("\n"), detectedSource));
  }

  return entries;
}
