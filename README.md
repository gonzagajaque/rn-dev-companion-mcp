# rn-dev-companion-mcp

An MCP server that gives Claude Code **real-time visibility** into your React Native app — terminal logs, JS runtime logs, network calls, Reactotron data, and native crash reports, all accessible through natural language.

## Why?

When debugging React Native with Claude Code, you constantly copy-paste logs, describe errors manually, and lose context switching between terminal, Reactotron, and your editor.

**rn-dev-companion** eliminates this friction:

- **Zero copy-paste** — Claude reads your Metro/Expo logs directly
- **JS runtime logs** — `console.log/warn/error` captured from Hermes via Chrome DevTools Protocol
- **Network inspector** — HTTP requests captured via CDP, no proxy or in-app setup needed
- **Reactotron integration** — API calls, Redux/Zustand state, benchmarks flow into Claude's context
- **Native crash reports** — iOS crash reports and Android crashes captured with full stack traces
- **Persistent logs** — optionally persist logs to disk so they survive server restarts
- **Always watching** — auto-detects Metro/Expo processes, reconnects to Reactotron and Hermes on its own

## Installation

```bash
claude mcp add rn-dev-companion-mcp -- npx rn-dev-companion-mcp
```

After restarting Claude Code, ask:

> "What's the app status?"

You should see connection info for all active monitors.

## Tools

| Tool | Description |
|------|-------------|
| `get_terminal_logs` | Metro/Expo terminal output with severity filtering |
| `get_hermes_logs` | JS runtime logs (console.log/warn/error) from Hermes via CDP |
| `get_network_calls` | HTTP network calls via CDP, filterable by URL and status code |
| `get_reactotron_logs` | Reactotron logs filtered by type (api, state, log, benchmark) |
| `get_errors` | Consolidated errors from terminal, Reactotron, and Hermes |
| `get_api_calls` | HTTP requests from Reactotron, filterable by endpoint |
| `get_state_changes` | Redux/MobX/Zustand dispatches with before/after diffs |
| `get_native_crashes` | Native crash reports from iOS and Android |
| `get_app_status` | Dashboard: all monitors status, error counts, uptime |
| `get_performance` | Benchmark and render time metrics from Reactotron |
| `search_logs` | Regex search across all log sources |
| `clear_logs` | Reset all buffers |

## Usage

Once installed, just talk to Claude naturally:

- *"What errors happened in the last few minutes?"*
- *"Show me the failing API calls"*
- *"What's the JS console output?"*
- *"Show me the network requests to /api/auth"*
- *"Did the app crash natively?"*
- *"What state changes happened after the login action?"*
- *"Search the logs for 'timeout'"*

## Configuration

Create `rn-companion.config.json` in your project root. All fields are optional — defaults work out of the box.

```json
{
  "reactotronPort": 9090,
  "metroPort": 8081,
  "autoDetectTerminal": true
}
```

### All options

| Option | Default | Description |
|--------|---------|-------------|
| `reactotronPort` | `9090` | WebSocket port for Reactotron |
| `terminalLogBufferSize` | `500` | Max terminal log entries in memory |
| `reactotronLogBufferSize` | `500` | Max Reactotron entries in memory |
| `autoDetectTerminal` | `true` | Auto-detect Metro/Expo processes |
| `filterPatterns` | `[]` | Regex patterns to exclude from logs |
| `hermesEnabled` | `true` | Capture JS runtime logs via Hermes/CDP |
| `metroPort` | `8081` | Metro bundler port for CDP discovery |
| `cdpCaptureNetwork` | `true` | Capture HTTP network calls via CDP |
| `persistLogs` | `false` | Persist logs to disk (JSONL) |
| `persistPath` | `~/.rn-dev-companion` | Directory for persisted logs |
| `persistFlushIntervalMs` | `5000` | Flush interval in ms |
| `persistMaxEntriesOnLoad` | `200` | Max entries to reload on startup |
| `iosCrashMonitorEnabled` | `true` | Watch iOS crash reports (macOS only) |
| `iosCrashReportPath` | `~/Library/Logs/DiagnosticReports` | iOS crash report directory |
| `androidCrashMonitorEnabled` | `true` | Monitor Android crashes via adb |
| `adbPath` | `adb` | Path to adb binary |

## Requirements

- Node.js >= 18
- Claude Code
- React Native project with Metro or Expo
- Reactotron (optional)
- adb (optional, for Android crash monitoring)

## License

MIT
