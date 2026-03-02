import { EventEmitter } from "events";
import { watch, readFileSync, readdirSync, statSync, FSWatcher } from "fs";
import { join } from "path";
import { LogStore } from "../storage/log-store.js";
import { parseIOSCrashReport } from "../parsers/crash-parser.js";

export class IOSCrashMonitor extends EventEmitter {
  private store: LogStore;
  private watchPath: string;
  private watcher: FSWatcher | null = null;
  private _active = false;
  private processedFiles = new Set<string>();

  constructor(store: LogStore, crashReportPath: string) {
    super();
    this.store = store;
    // Resolve ~ to home dir
    if (crashReportPath.startsWith("~")) {
      this.watchPath = join(
        process.env.HOME || "/tmp",
        crashReportPath.slice(1)
      );
    } else {
      this.watchPath = crashReportPath;
    }
  }

  get isActive(): boolean {
    return this._active;
  }

  start(): void {
    // Only run on macOS
    if (process.platform !== "darwin") {
      return;
    }

    try {
      // Scan recent crash files on startup
      this.scanExisting();

      // Watch for new crash files
      this.watcher = watch(this.watchPath, (eventType, filename) => {
        if (!filename) return;
        if (eventType === "rename" && this.isCrashFile(filename)) {
          // Small delay to let the OS finish writing
          setTimeout(() => {
            this.processCrashFile(join(this.watchPath, filename));
          }, 500);
        }
      });

      this.watcher.on("error", () => {
        // Directory might not exist or permission denied
        this._active = false;
      });

      this._active = true;
      this.emit("started");
    } catch {
      // Watch failed — directory might not exist
      this._active = false;
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this._active = false;
  }

  private isCrashFile(filename: string): boolean {
    return filename.endsWith(".crash") || filename.endsWith(".ips");
  }

  private scanExisting(): void {
    try {
      const files = readdirSync(this.watchPath)
        .filter((f) => this.isCrashFile(f))
        .map((f) => {
          const fullPath = join(this.watchPath, f);
          try {
            const stat = statSync(fullPath);
            return { path: fullPath, mtime: stat.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter((f): f is { path: string; mtime: number } => f !== null)
        .sort((a, b) => b.mtime - a.mtime);

      // Only process crashes from last 24 hours, max 10
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = files
        .filter((f) => f.mtime > cutoff)
        .slice(0, 10);

      for (const file of recent) {
        this.processCrashFile(file.path);
      }
    } catch {
      // Can't read directory
    }
  }

  private processCrashFile(filePath: string): void {
    if (this.processedFiles.has(filePath)) return;
    this.processedFiles.add(filePath);

    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = parseIOSCrashReport(content, filePath);

      if (parsed) {
        const entry = this.store.crashLogs.add(parsed);
        this.emit("crash", entry);
      }
    } catch {
      // Can't read file
    }
  }
}
