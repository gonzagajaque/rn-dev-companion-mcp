import { execSync, spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { parseTerminalLine, shouldFilterLog } from "../parsers/log-parser.js";
import { LogStore } from "../storage/log-store.js";
import { TerminalLogEntry } from "../types.js";

interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
}

export class TerminalMonitor extends EventEmitter {
  private store: LogStore;
  private filterPatterns: string[];
  private pollInterval: NodeJS.Timeout | null = null;
  private logProcess: ChildProcess | null = null;
  private detectedProcess: ProcessInfo | null = null;
  private _source: TerminalLogEntry["source"] = "unknown";

  constructor(store: LogStore, filterPatterns: string[] = []) {
    super();
    this.store = store;
    this.filterPatterns = filterPatterns;
  }

  get isRunning(): boolean {
    return this.detectedProcess !== null;
  }

  get processName(): string | null {
    return this.detectedProcess?.cmd ?? null;
  }

  start(autoDetect: boolean): void {
    if (autoDetect) {
      this.startPolling();
    }
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.stopLogCapture();
  }

  private startPolling(): void {
    this.checkForProcesses();
    this.pollInterval = setInterval(() => this.checkForProcesses(), 5000);
  }

  private checkForProcesses(): void {
    try {
      const processes = this.findRNProcesses();
      if (processes.length > 0 && !this.detectedProcess) {
        this.detectedProcess = processes[0];
        this._source = this.detectSource(this.detectedProcess.cmd);
        this.emit("process-detected", this.detectedProcess);
        this.startLogCapture(this.detectedProcess.pid);
      } else if (processes.length === 0 && this.detectedProcess) {
        this.emit("process-lost", this.detectedProcess);
        this.detectedProcess = null;
        this._source = "unknown";
        this.stopLogCapture();
      }
    } catch {
      // Silently continue polling
    }
  }

  private findRNProcesses(): ProcessInfo[] {
    try {
      const output = execSync(
        "ps aux | grep -E '(react-native start|expo start|metro)' | grep -v grep",
        { encoding: "utf-8", timeout: 3000 }
      );

      return output
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[1], 10);
          const cmd = parts.slice(10).join(" ");
          return { pid, name: parts[10] ?? "unknown", cmd };
        })
        .filter((p) => !isNaN(p.pid));
    } catch {
      return [];
    }
  }

  private detectSource(cmd: string): TerminalLogEntry["source"] {
    if (/expo/i.test(cmd)) return "expo";
    if (/metro/i.test(cmd)) return "metro";
    if (/react-native/i.test(cmd)) return "react-native";
    return "unknown";
  }

  private startLogCapture(pid: number): void {
    this.stopLogCapture();

    try {
      // Use lsof to find the terminal of the process, then tail its output
      // Fallback: attach to the process stdout via /proc or dtrace
      // Most reliable cross-platform: pipe process output
      this.logProcess = spawn("bash", [
        "-c",
        `
        # Try to read from the process fd on macOS
        if [ -d /proc/${pid}/fd ]; then
          tail -f /proc/${pid}/fd/1 /proc/${pid}/fd/2 2>/dev/null
        else
          # macOS fallback: use log stream or dtrace for the process
          # Simple approach: monitor system log for the process
          log stream --process ${pid} --style compact 2>/dev/null || \
          tail -f /dev/null
        fi
        `,
      ]);

      this.logProcess.stdout?.on("data", (data: Buffer) => {
        this.processLogData(data.toString());
      });

      this.logProcess.stderr?.on("data", (data: Buffer) => {
        this.processLogData(data.toString());
      });

      this.logProcess.on("error", () => {
        // Process capture failed, continue without it
      });

      this.logProcess.on("exit", () => {
        this.logProcess = null;
      });
    } catch {
      // Failed to start log capture
    }
  }

  private stopLogCapture(): void {
    if (this.logProcess) {
      this.logProcess.kill();
      this.logProcess = null;
    }
  }

  private processLogData(data: string): void {
    const lines = data.split("\n").filter(Boolean);
    for (const line of lines) {
      if (shouldFilterLog(line, this.filterPatterns)) continue;

      const parsed = parseTerminalLine(line, this._source);
      const entry = this.store.terminalLogs.add(parsed);
      this.emit("log", entry);

      if (entry.severity === "error" || entry.isNativeCrash) {
        this.emit("error", entry);
      }
    }
  }

  /** Manually inject a log line (useful for piping external sources) */
  injectLog(line: string): void {
    if (shouldFilterLog(line, this.filterPatterns)) return;
    const parsed = parseTerminalLine(line, this._source);
    const entry = this.store.terminalLogs.add(parsed);
    this.emit("log", entry);
  }
}
