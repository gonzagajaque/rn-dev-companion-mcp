import { CrashLogEntry } from "../types.js";

// --- iOS crash report parsing ---

const RN_PROCESS_HINTS = [
  "reactnative",
  "expo",
  "hermes",
  "jsc",
  // Common RN app bundle identifiers contain these
];

export function parseIOSCrashReport(
  content: string,
  filePath: string
): Omit<CrashLogEntry, "id"> | null {
  const processMatch = content.match(/^Process:\s+(.+?)(?:\s+\[|$)/m);
  const processName = processMatch?.[1]?.trim() ?? "Unknown";

  // Check if this is an RN-related crash (skip system processes)
  const isRNRelated =
    RN_PROCESS_HINTS.some((hint) =>
      content.toLowerCase().includes(hint)
    ) ||
    // .ips format may have different identifiers
    content.includes("JavaScriptCore") ||
    content.includes("libjsc") ||
    // If we can't determine, include it (better to show than miss)
    processMatch !== null;

  if (!isRNRelated) return null;

  const exceptionMatch = content.match(/^Exception Type:\s+(.+)$/m);
  const signalMatch = content.match(/^Exception Codes:\s+(.+)$/m);
  const reasonMatch =
    content.match(/^Application Specific Information:\s*\n(.+)/m) ??
    content.match(/^Termination Reason:\s+(.+)$/m) ??
    content.match(/^Exception Type:\s+(.+)$/m);

  // Extract the crashed thread's stack trace
  const crashedThreadMatch = content.match(
    /^(Thread \d+ Crashed.*?:)\n([\s\S]*?)(?=\nThread \d+ |$|\nBinary Images)/m
  );
  const stackTrace = crashedThreadMatch
    ? `${crashedThreadMatch[1]}\n${crashedThreadMatch[2].trim()}`
    : extractFirstStackTrace(content);

  // Try to get timestamp from file
  const dateMatch =
    content.match(/^Date\/Time:\s+(.+)$/m) ??
    content.match(/"timestamp"\s*:\s*"(.+?)"/);

  return {
    timestamp: dateMatch?.[1] ?? new Date().toISOString(),
    platform: "ios",
    processName,
    crashReason: reasonMatch?.[1]?.trim() ?? "Unknown crash reason",
    exceptionType: exceptionMatch?.[1]?.trim(),
    signal: signalMatch?.[1]?.trim(),
    stackTrace: stackTrace || "No stack trace available",
    rawFilePath: filePath,
  };
}

function extractFirstStackTrace(content: string): string {
  const lines = content.split("\n");
  const stackLines: string[] = [];
  let inStack = false;

  for (const line of lines) {
    if (/^\d+\s+\w/.test(line) || /^Thread \d+/.test(line)) {
      inStack = true;
    }
    if (inStack) {
      if (line.trim() === "" && stackLines.length > 0) break;
      stackLines.push(line);
      if (stackLines.length >= 30) break;
    }
  }

  return stackLines.join("\n");
}

// --- Android crash parsing ---

export function parseAndroidFatalException(lines: string[]): Omit<CrashLogEntry, "id"> | null {
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  // Typical: FATAL EXCEPTION: main
  const threadMatch = firstLine.match(/FATAL EXCEPTION:\s+(.+)/);

  // Find the exception line (usually line 2+)
  let crashReason = "Unknown fatal exception";
  let exceptionType: string | undefined;
  const stackLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Exception lines look like: java.lang.NullPointerException: Attempt to invoke...
    const exMatch = line.match(/^\s*([\w.]+Exception|[\w.]+Error):\s*(.*)/);
    if (exMatch && !exceptionType) {
      exceptionType = exMatch[1];
      crashReason = exMatch[2] || exMatch[1];
    }
    stackLines.push(line);
  }

  return {
    timestamp: new Date().toISOString(),
    platform: "android",
    processName: threadMatch?.[1]?.trim() ?? "main",
    crashReason,
    exceptionType,
    stackTrace: stackLines.join("\n"),
  };
}

export function parseAndroidNativeSignal(line: string): Omit<CrashLogEntry, "id"> | null {
  // Format: Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0 in tid 12345 (main)
  const match = line.match(
    /Fatal signal \d+ \((\w+)\).*?(?:in tid \d+ \((.+?)\))?/
  );
  if (!match) return null;

  return {
    timestamp: new Date().toISOString(),
    platform: "android",
    processName: match[2] ?? "unknown",
    crashReason: line.trim(),
    signal: match[1],
    stackTrace: line,
  };
}
