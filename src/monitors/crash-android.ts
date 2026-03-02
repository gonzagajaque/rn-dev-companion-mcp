import { EventEmitter } from "events";
import { spawn, execSync, ChildProcess } from "child_process";
import { LogStore } from "../storage/log-store.js";
import {
  parseAndroidFatalException,
  parseAndroidNativeSignal,
} from "../parsers/crash-parser.js";

export class AndroidCrashMonitor extends EventEmitter {
  private store: LogStore;
  private adbPath: string;
  private logcatProcess: ChildProcess | null = null;
  private _active = false;
  private fatalBuffer: string[] = [];
  private collectingFatal = false;

  constructor(store: LogStore, adbPath = "adb") {
    super();
    this.store = store;
    this.adbPath = adbPath;
  }

  get isActive(): boolean {
    return this._active;
  }

  start(): void {
    if (!this.isAdbAvailable()) {
      return;
    }

    try {
      // Use logcat with error-level filter
      this.logcatProcess = spawn(this.adbPath, [
        "logcat",
        "*:E",
        "-v",
        "threadtime",
      ]);

      this.logcatProcess.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          this.processLine(line);
        }
      });

      this.logcatProcess.stderr?.on("data", () => {
        // adb errors — ignore
      });

      this.logcatProcess.on("error", () => {
        this._active = false;
      });

      this.logcatProcess.on("exit", () => {
        this._active = false;
        this.logcatProcess = null;
      });

      this._active = true;
      this.emit("started");
    } catch {
      this._active = false;
    }
  }

  stop(): void {
    if (this.logcatProcess) {
      this.logcatProcess.kill();
      this.logcatProcess = null;
    }
    this._active = false;
    this.flushFatalBuffer();
  }

  private isAdbAvailable(): boolean {
    try {
      execSync(`${this.adbPath} devices`, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  private processLine(line: string): void {
    // Detect FATAL EXCEPTION from AndroidRuntime
    if (/AndroidRuntime.*FATAL EXCEPTION/.test(line) || /FATAL EXCEPTION:/.test(line)) {
      // Flush any previous fatal buffer
      this.flushFatalBuffer();
      this.collectingFatal = true;
      this.fatalBuffer = [this.extractMessage(line)];
      return;
    }

    // Continue collecting fatal exception lines
    if (this.collectingFatal) {
      const msg = this.extractMessage(line);
      // Fatal exception block ends when we see a non-continuation line
      if (
        msg.startsWith("\t") ||
        msg.startsWith("    ") ||
        /^\s*(at |Caused by|\.\.\.)\s/.test(msg) ||
        /^\s*[\w.]+(?:Exception|Error)/.test(msg)
      ) {
        this.fatalBuffer.push(msg);
        return;
      } else {
        this.flushFatalBuffer();
        // Continue processing this line below
      }
    }

    // Detect native signals (SIGSEGV, SIGABRT, etc.)
    if (/Fatal signal|libc\s*:\s*Fatal signal/.test(line)) {
      const parsed = parseAndroidNativeSignal(this.extractMessage(line));
      if (parsed) {
        const entry = this.store.crashLogs.add(parsed);
        this.emit("crash", entry);
      }
    }
  }

  private flushFatalBuffer(): void {
    if (!this.collectingFatal || this.fatalBuffer.length === 0) {
      this.collectingFatal = false;
      this.fatalBuffer = [];
      return;
    }

    const parsed = parseAndroidFatalException(this.fatalBuffer);
    if (parsed) {
      const entry = this.store.crashLogs.add(parsed);
      this.emit("crash", entry);
    }

    this.collectingFatal = false;
    this.fatalBuffer = [];
  }

  /** Extract the message portion from a logcat line, stripping timestamp/pid/tag prefix */
  private extractMessage(line: string): string {
    // Logcat threadtime format: MM-DD HH:MM:SS.mmm PID TID level tag: message
    const match = line.match(
      /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+\w\s+[\w./-]+\s*:\s*(.*)/
    );
    return match?.[1] ?? line;
  }
}
