import WebSocket from "ws";
import { EventEmitter } from "events";
import { request as httpRequest } from "http";
import { LogStore } from "../storage/log-store.js";
import {
  parseCDPConsole,
  parseCDPRequest,
  parseCDPResponse,
  isCDPConsoleEvent,
  isCDPRequestEvent,
  isCDPResponseEvent,
  PendingRequest,
} from "../parsers/cdp-parser.js";

interface CDPTarget {
  id: string;
  title: string;
  webSocketDebuggerUrl: string;
}

export class HermesMonitor extends EventEmitter {
  private store: LogStore;
  private metroPort: number;
  private captureNetwork: boolean;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private discoveryTimer: NodeJS.Timeout | null = null;
  private _connected = false;
  private shouldReconnect = true;
  private pendingRequests = new Map<string, PendingRequest>();
  private cdpMessageId = 1;

  constructor(store: LogStore, metroPort = 8081, captureNetwork = true) {
    super();
    this.store = store;
    this.metroPort = metroPort;
    this.captureNetwork = captureNetwork;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  start(): void {
    this.shouldReconnect = true;
    this.startDiscovery();
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  private startDiscovery(): void {
    this.discover();
    this.discoveryTimer = setInterval(() => {
      if (!this._connected) {
        this.discover();
      }
    }, 5000);
  }

  private discover(): void {
    const req = httpRequest(
      { hostname: "localhost", port: this.metroPort, path: "/json", method: "GET", timeout: 3000 },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const targets = JSON.parse(data) as CDPTarget[];
            const target = targets.find(
              (t) => t.webSocketDebuggerUrl && t.title !== "React Native Experimental (Improved Chrome Reloads)"
            );
            if (target) {
              this.connectToTarget(target.webSocketDebuggerUrl);
            }
          } catch {
            // Invalid JSON from discovery
          }
        });
      }
    );

    req.on("error", () => {
      // Metro not reachable yet
    });

    req.on("timeout", () => {
      req.destroy();
    });

    req.end();
  }

  private connectToTarget(wsUrl: string): void {
    if (this._connected || this.ws) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        this._connected = true;
        this.emit("connected");
        this.enableDomains();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch {
          // Invalid JSON
        }
      });

      this.ws.on("close", () => {
        this._connected = false;
        this.ws = null;
        this.pendingRequests.clear();
        this.emit("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", () => {
        this._connected = false;
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        this.scheduleReconnect();
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private enableDomains(): void {
    this.sendCDP("Runtime.enable");
    if (this.captureNetwork) {
      this.sendCDP("Network.enable");
    }
  }

  private sendCDP(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = { id: this.cdpMessageId++, method, params: params ?? {} };
    this.ws.send(JSON.stringify(msg));
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.discover();
      }
    }, 5000);
  }

  private handleMessage(msg: { method?: string; params?: unknown }): void {
    if (!msg.method) return;

    const event = msg as { method: string; params: unknown };

    if (isCDPConsoleEvent(event as never)) {
      const parsed = parseCDPConsole(event as never);
      const entry = this.store.hermesLogs.add(parsed);
      this.emit("log", entry);
    } else if (isCDPRequestEvent(event as never)) {
      const pending = parseCDPRequest(event as never);
      this.pendingRequests.set(pending.requestId, pending);
      this.emit("network-request", pending);
    } else if (isCDPResponseEvent(event as never)) {
      const typedEvent = event as never;
      const requestId = (typedEvent as { params: { requestId: string } }).params.requestId;
      const pending = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      const parsed = parseCDPResponse(typedEvent, pending);
      const entry = this.store.networkCalls.add(parsed);
      this.emit("network-response", entry);
    }
  }
}
