import WebSocket from "ws";
import { EventEmitter } from "events";
import { parseReactotronMessage } from "../parsers/reactotron-parser.js";
import { LogStore } from "../storage/log-store.js";

export class ReactotronMonitor extends EventEmitter {
  private store: LogStore;
  private port: number;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private _connected = false;
  private shouldReconnect = true;

  constructor(store: LogStore, port = 9090) {
    super();
    this.store = store;
    this.port = port;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  start(): void {
    this.shouldReconnect = true;
    this.connect();
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  private connect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on("open", () => {
        this._connected = true;
        this.emit("connected");
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch {
          // Invalid JSON, skip
        }
      });

      this.ws.on("close", () => {
        this._connected = false;
        this.emit("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", () => {
        this._connected = false;
        this.scheduleReconnect();
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, 3000);
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const parsed = parseReactotronMessage(
      msg as unknown as Parameters<typeof parseReactotronMessage>[0]
    );

    const logEntry = this.store.reactotronLogs.add(parsed.logEntry);
    this.emit("log", logEntry);

    if (parsed.apiCall) {
      const apiEntry = this.store.apiCalls.add(parsed.apiCall);
      this.emit("api-call", apiEntry);
    }

    if (parsed.stateChange) {
      const stateEntry = this.store.stateChanges.add(parsed.stateChange);
      this.emit("state-change", stateEntry);
    }

    if (parsed.performanceEntry) {
      const perfEntry = this.store.performanceEntries.add(parsed.performanceEntry);
      this.emit("performance", perfEntry);
    }
  }
}
