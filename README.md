# rn-dev-companion-mcp

An MCP (Model Context Protocol) server that gives Claude Code **real-time visibility** into your React Native app — terminal logs, JS runtime logs via Hermes/CDP, network calls, Reactotron data, native crash reports (iOS & Android), all accessible through natural language.

## Why?

When debugging React Native with Claude Code, you constantly copy-paste logs, describe errors manually, and lose context switching between terminal, Reactotron, and your editor.

**rn-dev-companion** eliminates this friction:

- **Zero copy-paste** — Claude reads your Metro/Expo logs directly
- **JS runtime logs** — `console.log/warn/error` captured directly from Hermes via Chrome DevTools Protocol
- **Network inspector** — HTTP requests captured via CDP, no proxy or in-app setup needed
- **Reactotron integration** — API calls, Redux/Zustand state, benchmarks flow into Claude's context automatically
- **Native crash forensics** — iOS crash reports (DiagnosticReports) and Android crashes (adb logcat) captured with full stack traces
- **Persistent logs** — optionally persist logs to disk so they survive server restarts
- **One question away** — ask "what errors happened?" instead of scrolling through terminal noise
- **Always watching** — auto-detects Metro/Expo processes, reconnects to Reactotron and Hermes on its own

## How it works

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Metro/Expo │────▶│  rn-dev-companion    │◀───▶│ Claude Code │
│  Terminal   │     │  (MCP Server)        │     │             │
└─────────────┘     │                      │     │  "What API  │
                    │  • Terminal logs     │     │   calls are │
┌─────────────┐     │  • Hermes/CDP logs   │     │   failing?" │
│   Hermes    │────▶│  • Network calls     │     │             │
│  (CDP/WS)   │     │  • Reactotron data   │     └─────────────┘
└─────────────┘     │  • iOS crash reports │
                    │  • Android crashes   │
┌─────────────┐     │  • Disk persistence  │
│  Reactotron │────▶│                      │
│  (WebSocket)│     └──────────────────────┘
└─────────────┘
        ▲
┌───────┴─────┐
│  iOS / ADB  │
│  Crash Logs │
└─────────────┘
```

The server runs alongside your dev environment, passively collecting data from multiple sources:

1. **Terminal monitor** — polls for Metro/Expo/React Native CLI processes and captures their stdout/stderr
2. **Hermes/CDP monitor** — connects to Metro's debugger WebSocket, captures `console.*` calls and HTTP network traffic via Chrome DevTools Protocol
3. **Reactotron monitor** — connects via WebSocket (port 9090) to receive structured logs, API calls, state changes and benchmarks
4. **iOS crash monitor** — watches `~/Library/Logs/DiagnosticReports/` for new `.crash`/`.ips` files (macOS only)
5. **Android crash monitor** — runs `adb logcat *:E` to capture `FATAL EXCEPTION` and native signals (requires adb)
6. **Disk persistence** — optionally writes all logs to JSONL files for survival across restarts

Claude Code accesses this data through 12 MCP tools, asking only for what it needs.

## Tools

| Tool | What it does |
|------|-------------|
| `get_terminal_logs` | Metro/Expo terminal output with severity filtering |
| `get_reactotron_logs` | Reactotron logs filtered by type (api, state, log, benchmark) |
| `get_hermes_logs` | JS runtime logs (console.log/warn/error) from Hermes via CDP |
| `get_network_calls` | HTTP requests captured via CDP, filterable by URL and status code |
| `get_errors` | Consolidated errors from terminal, Reactotron, and Hermes |
| `get_api_calls` | HTTP requests captured by Reactotron, filterable by endpoint |
| `get_state_changes` | Redux/MobX/Zustand dispatches with before/after diffs |
| `get_native_crashes` | Native crash reports from iOS and Android, filterable by platform |
| `get_app_status` | Dashboard: all monitors status, error counts, uptime |
| `get_performance` | Benchmark and render time metrics from Reactotron |
| `search_logs` | Regex search across all log sources (terminal, Reactotron, Hermes, network) |
| `clear_logs` | Reset all buffers |

## Installation

### Quick install (recommended)

```bash
npm run install-mcp
```

This builds the project and registers it with Claude Code in one step.

### Manual install

```bash
# 1. Install and build
npm install
npm run build

# 2. Register in Claude Code
claude mcp add rn-dev-companion -- node /absolute/path/to/dist/index.js
```

### Verify

After restarting Claude Code, ask:

> "What's the app status?"

You should see connection info for all monitors.

## Configuration

Create `rn-companion.config.json` in your project root:

```json
{
  "reactotronPort": 9090,
  "terminalLogBufferSize": 500,
  "reactotronLogBufferSize": 500,
  "autoDetectTerminal": true,
  "watchPaths": [],
  "filterPatterns": [],
  "hermesEnabled": true,
  "metroPort": 8081,
  "cdpCaptureNetwork": true,
  "persistLogs": false,
  "persistPath": "~/.rn-dev-companion",
  "persistFlushIntervalMs": 5000,
  "persistMaxEntriesOnLoad": 200,
  "iosCrashMonitorEnabled": true,
  "iosCrashReportPath": "~/Library/Logs/DiagnosticReports",
  "androidCrashMonitorEnabled": true,
  "adbPath": "adb"
}
```

All options are optional — defaults are used for any missing field.

### General

| Option | Default | Description |
|--------|---------|-------------|
| `reactotronPort` | `9090` | WebSocket port for Reactotron connection |
| `terminalLogBufferSize` | `500` | Max terminal log entries kept in memory |
| `reactotronLogBufferSize` | `500` | Max Reactotron entries kept in memory |
| `autoDetectTerminal` | `true` | Auto-detect Metro/Expo processes |
| `watchPaths` | `[]` | Additional paths to watch for logs |
| `filterPatterns` | `[]` | Regex patterns to exclude from logs |

### Hermes/CDP

| Option | Default | Description |
|--------|---------|-------------|
| `hermesEnabled` | `true` | Enable Hermes/CDP monitor for JS runtime logs |
| `metroPort` | `8081` | Metro bundler port (used for CDP target discovery) |
| `cdpCaptureNetwork` | `true` | Capture HTTP network calls via CDP |

The Hermes monitor discovers debuggable targets via `GET http://localhost:<metroPort>/json`, then connects to the target's WebSocket and enables `Runtime.enable` + `Network.enable` domains.

### Persistence

| Option | Default | Description |
|--------|---------|-------------|
| `persistLogs` | `false` | Enable disk persistence (JSONL files) |
| `persistPath` | `~/.rn-dev-companion` | Directory for persisted log files |
| `persistFlushIntervalMs` | `5000` | Batch flush interval in milliseconds |
| `persistMaxEntriesOnLoad` | `200` | Max entries to load from disk on startup |

When enabled, logs are written to JSONL files (`terminal.jsonl`, `reactotron.jsonl`, `hermes.jsonl`, `network.jsonl`, `api.jsonl`, `state.jsonl`, `performance.jsonl`, `crash.jsonl`) and reloaded on server restart.

### Native crash monitors

| Option | Default | Description |
|--------|---------|-------------|
| `iosCrashMonitorEnabled` | `true` | Watch for iOS crash reports (auto-skipped if not macOS) |
| `iosCrashReportPath` | `~/Library/Logs/DiagnosticReports` | Directory with iOS crash/ips files |
| `androidCrashMonitorEnabled` | `true` | Monitor Android crashes via adb (auto-skipped if adb not found) |
| `adbPath` | `adb` | Path to adb binary |

## Usage examples

Once installed, just talk to Claude naturally:

- *"What errors happened in the last few minutes?"*
- *"Show me the failing API calls"*
- *"What's the JS console output?"* — uses `get_hermes_logs`
- *"Show me the network requests to /api/auth"* — uses `get_network_calls`
- *"Did the app crash natively?"* — uses `get_native_crashes`
- *"What state changes happened after the login action?"*
- *"Is Metro running? Is Reactotron connected? Is Hermes connected?"*
- *"Search the logs for 'timeout'"*
- *"What are the performance bottlenecks?"*

## Architecture

```
src/
├── index.ts                    Entry point, config loading, graceful shutdown
├── server.ts                   MCP server setup, tool/resource registration, monitor wiring
├── types.ts                    All TypeScript interfaces
├── monitors/
│   ├── terminal.ts             Metro/Expo process auto-detection and log capture
│   ├── reactotron.ts           Reactotron WebSocket client with auto-reconnect
│   ├── hermes.ts               Hermes/CDP WebSocket client (Runtime + Network domains)
│   ├── crash-ios.ts            iOS crash report watcher (DiagnosticReports)
│   └── crash-android.ts        Android crash monitor (adb logcat)
├── parsers/
│   ├── log-parser.ts           Terminal log line parsing (severity, crashes, ANSI cleanup)
│   ├── reactotron-parser.ts    Reactotron message → structured entries
│   ├── cdp-parser.ts           CDP events → HermesLogEntry / NetworkEntry
│   └── crash-parser.ts         iOS .crash/.ips + Android FATAL EXCEPTION parsing
├── storage/
│   ├── log-store.ts            Circular buffers for all entry types
│   └── persistence.ts          JSONL append-only persistence with batch flush
└── tools/
    ├── get-logs.ts             get_terminal_logs, get_reactotron_logs
    ├── get-hermes-logs.ts      get_hermes_logs
    ├── get-network.ts          get_network_calls
    ├── get-errors.ts           get_errors (terminal + Reactotron + Hermes)
    ├── get-api-calls.ts        get_api_calls
    ├── get-state.ts            get_state_changes
    ├── get-crashes.ts          get_native_crashes
    ├── get-status.ts           get_app_status
    ├── get-performance.ts      get_performance
    ├── search-logs.ts          search_logs
    └── clear-logs.ts           clear_logs
```

## Requirements

- Node.js >= 18
- Claude Code CLI
- React Native project with Metro/Expo
- Reactotron (optional, for API/state/performance data)
- adb (optional, for Android crash monitoring)

## License

MIT
