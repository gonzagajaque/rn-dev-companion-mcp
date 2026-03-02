import { mkdirSync, appendFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { LogStore, CircularBuffer } from "./log-store.js";

interface PersistConfig {
  persistPath: string;
  flushIntervalMs: number;
  maxEntriesOnLoad: number;
}

const FILE_MAP = {
  terminal: "terminal.jsonl",
  reactotron: "reactotron.jsonl",
  api: "api.jsonl",
  state: "state.jsonl",
  performance: "performance.jsonl",
  hermes: "hermes.jsonl",
  network: "network.jsonl",
  crash: "crash.jsonl",
} as const;

type BufferName = keyof typeof FILE_MAP;

export class LogPersistence {
  private config: PersistConfig;
  private pendingWrites: Map<BufferName, string[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: PersistConfig) {
    this.config = config;
    const dir = this.resolvedPath();
    mkdirSync(dir, { recursive: true });

    for (const key of Object.keys(FILE_MAP) as BufferName[]) {
      this.pendingWrites.set(key, []);
    }
  }

  private resolvedPath(): string {
    const p = this.config.persistPath;
    if (p.startsWith("~")) {
      return join(process.env.HOME || "/tmp", p.slice(1));
    }
    return p;
  }

  private filePath(name: BufferName): string {
    return join(this.resolvedPath(), FILE_MAP[name]);
  }

  /** Hook all store buffers for write-behind persistence */
  attach(store: LogStore): void {
    const hookBuffer = <T extends { id: number }>(
      buffer: CircularBuffer<T>,
      name: BufferName
    ) => {
      buffer.onAdd((item) => {
        const pending = this.pendingWrites.get(name)!;
        pending.push(JSON.stringify(item));
      });
    };

    hookBuffer(store.terminalLogs, "terminal");
    hookBuffer(store.reactotronLogs, "reactotron");
    hookBuffer(store.apiCalls, "api");
    hookBuffer(store.stateChanges, "state");
    hookBuffer(store.performanceEntries, "performance");
    hookBuffer(store.hermesLogs, "hermes");
    hookBuffer(store.networkCalls, "network");
    hookBuffer(store.crashLogs, "crash");

    this.startFlushTimer();
  }

  /** Load persisted entries back into store buffers */
  loadInto(store: LogStore): void {
    const max = this.config.maxEntriesOnLoad;

    this.loadFile("terminal", store.terminalLogs, max);
    this.loadFile("reactotron", store.reactotronLogs, max);
    this.loadFile("api", store.apiCalls, max);
    this.loadFile("state", store.stateChanges, max);
    this.loadFile("performance", store.performanceEntries, max);
    this.loadFile("hermes", store.hermesLogs, max);
    this.loadFile("network", store.networkCalls, max);
    this.loadFile("crash", store.crashLogs, max);
  }

  private loadFile<T extends { id: number }>(
    name: BufferName,
    buffer: CircularBuffer<T>,
    maxEntries: number
  ): void {
    const fp = this.filePath(name);
    if (!existsSync(fp)) return;

    try {
      const content = readFileSync(fp, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      const tail = lines.slice(-maxEntries);

      const items: T[] = [];
      for (const line of tail) {
        try {
          items.push(JSON.parse(line) as T);
        } catch {
          // skip malformed lines
        }
      }

      if (items.length > 0) {
        buffer.loadBulk(items);
      }
    } catch {
      // file read error, skip
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /** Flush all pending writes to disk */
  flush(): void {
    for (const [name, lines] of this.pendingWrites.entries()) {
      if (lines.length === 0) continue;

      const fp = this.filePath(name);
      try {
        appendFileSync(fp, lines.join("\n") + "\n");
      } catch {
        // write error, skip
      }
      this.pendingWrites.set(name, []);
    }
  }

  /** Stop flush timer and write remaining data */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
