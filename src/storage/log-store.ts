import {
  TerminalLogEntry,
  ReactotronLogEntry,
  ApiCallEntry,
  StateChangeEntry,
  PerformanceEntry,
  HermesLogEntry,
  NetworkEntry,
  CrashLogEntry,
} from "../types.js";

export class CircularBuffer<T extends { id: number }> {
  private buffer: T[] = [];
  private maxSize: number;
  private nextId = 1;
  private _onAdd?: (item: T) => void;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  onAdd(callback: (item: T) => void): void {
    this._onAdd = callback;
  }

  add(item: Omit<T, "id">): T {
    const entry = { ...item, id: this.nextId++ } as T;
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
    this._onAdd?.(entry);
    return entry;
  }

  loadBulk(items: T[]): void {
    for (const item of items) {
      if (this.buffer.length >= this.maxSize) {
        this.buffer.shift();
      }
      this.buffer.push(item);
      if (item.id >= this.nextId) {
        this.nextId = item.id + 1;
      }
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  getLast(n: number): T[] {
    return this.buffer.slice(-n);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.buffer.filter(predicate);
  }

  search(query: string): T[] {
    const regex = new RegExp(query, "i");
    return this.buffer.filter((item) => regex.test(JSON.stringify(item)));
  }

  count(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.nextId = 1;
  }
}

export class LogStore {
  readonly terminalLogs: CircularBuffer<TerminalLogEntry>;
  readonly reactotronLogs: CircularBuffer<ReactotronLogEntry>;
  readonly apiCalls: CircularBuffer<ApiCallEntry>;
  readonly stateChanges: CircularBuffer<StateChangeEntry>;
  readonly performanceEntries: CircularBuffer<PerformanceEntry>;
  readonly hermesLogs: CircularBuffer<HermesLogEntry>;
  readonly networkCalls: CircularBuffer<NetworkEntry>;
  readonly crashLogs: CircularBuffer<CrashLogEntry>;

  constructor(terminalBufferSize = 500, reactotronBufferSize = 500) {
    this.terminalLogs = new CircularBuffer<TerminalLogEntry>(terminalBufferSize);
    this.reactotronLogs = new CircularBuffer<ReactotronLogEntry>(reactotronBufferSize);
    this.apiCalls = new CircularBuffer<ApiCallEntry>(reactotronBufferSize);
    this.stateChanges = new CircularBuffer<StateChangeEntry>(reactotronBufferSize);
    this.performanceEntries = new CircularBuffer<PerformanceEntry>(reactotronBufferSize);
    this.hermesLogs = new CircularBuffer<HermesLogEntry>(reactotronBufferSize);
    this.networkCalls = new CircularBuffer<NetworkEntry>(reactotronBufferSize);
    this.crashLogs = new CircularBuffer<CrashLogEntry>(200);
  }

  getErrors(): (TerminalLogEntry | ReactotronLogEntry | HermesLogEntry)[] {
    const terminalErrors = this.terminalLogs.filter(
      (log) => log.severity === "error" || log.isNativeCrash === true
    );
    const reactotronErrors = this.reactotronLogs.filter(
      (log) => log.type === "log" && log.important === true
    );
    const hermesErrors = this.hermesLogs.filter(
      (log) => log.level === "error"
    );
    return [
      ...terminalErrors.map((e) => ({ ...e, _source: "terminal" as const })),
      ...reactotronErrors.map((e) => ({ ...e, _source: "reactotron" as const })),
      ...hermesErrors.map((e) => ({ ...e, _source: "hermes" as const })),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  getLastCrash(): TerminalLogEntry | CrashLogEntry | null {
    const terminalCrashes = this.terminalLogs.filter(
      (log) => log.isNativeCrash || log.severity === "error"
    );
    const nativeCrashes = this.crashLogs.getAll();

    const lastTerminal = terminalCrashes.length > 0 ? terminalCrashes[terminalCrashes.length - 1] : null;
    const lastNative = nativeCrashes.length > 0 ? nativeCrashes[nativeCrashes.length - 1] : null;

    if (!lastTerminal) return lastNative;
    if (!lastNative) return lastTerminal;
    return lastTerminal.timestamp > lastNative.timestamp ? lastTerminal : lastNative;
  }

  searchAll(query: string): {
    terminal: TerminalLogEntry[];
    reactotron: ReactotronLogEntry[];
    hermes: HermesLogEntry[];
    network: NetworkEntry[];
  } {
    return {
      terminal: this.terminalLogs.search(query),
      reactotron: this.reactotronLogs.search(query),
      hermes: this.hermesLogs.search(query),
      network: this.networkCalls.search(query),
    };
  }

  clearAll(): void {
    this.terminalLogs.clear();
    this.reactotronLogs.clear();
    this.apiCalls.clear();
    this.stateChanges.clear();
    this.performanceEntries.clear();
    this.hermesLogs.clear();
    this.networkCalls.clear();
    this.crashLogs.clear();
  }
}
