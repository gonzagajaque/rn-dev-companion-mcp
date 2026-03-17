<p align="center">
  <img src="assets/wiretap-logo.webp" alt="Wiretap" width="280" />
</p>

<h1 align="center">Wiretap</h1>

<p align="center">
  <strong>Real-time visibility into your React Native app for Claude Code.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wiretap-mcp"><img src="https://img.shields.io/npm/v/wiretap-mcp?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/wiretap-mcp"><img src="https://img.shields.io/npm/dm/wiretap-mcp?style=flat-square&color=blue" alt="npm downloads" /></a>
  <a href="https://github.com/gonzagajaque/wiretap-mcp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="node version" /></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-compatible-8A2BE2?style=flat-square" alt="MCP compatible" /></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> &nbsp;&bull;&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;&bull;&nbsp;
  <a href="#tools">Tools</a> &nbsp;&bull;&nbsp;
  <a href="#usage">Usage</a> &nbsp;&bull;&nbsp;
  <a href="#configuration">Configuration</a>
</p>

---

## The Problem

When debugging React Native with Claude Code, you constantly copy-paste logs, describe errors manually, and lose context switching between terminal, Reactotron, and your editor. Claude is powerful, but blind to what your app is actually doing.

## The Solution

Wiretap is an MCP server that taps directly into every signal your app emits. Terminal logs, JS runtime output, network traffic, state changes, native crashes. Claude Code sees it all in real time, and you interact with it through natural language.

No copy-paste. No context switching. Just ask.

## Features

**Zero copy-paste.** Claude reads your Metro and Expo logs directly.

**JS runtime logs.** `console.log`, `console.warn`, and `console.error` captured from Hermes via Chrome DevTools Protocol.

**Network inspector.** HTTP requests captured via CDP with no proxy or in-app setup needed.

**Reactotron integration.** API calls, Redux and Zustand state, and benchmarks flow into Claude's context automatically.

**Native crash reports.** iOS crash reports and Android crashes captured with full stack traces.

**Persistent logs.** Optionally persist logs to disk so they survive server restarts.

**Always watching.** Auto-detects Metro and Expo processes, reconnects to Reactotron and Hermes on its own.

## Installation

```bash
claude mcp add wiretap -- npx wiretap-mcp
```

After restarting Claude Code, ask:

> "What's the app status?"

You should see connection info for all active monitors.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Your RN App                          │
│                                                         │
│   Metro/Expo    Hermes Runtime    Reactotron    Native  │
│       │              │               │            │     │
└───────┼──────────────┼───────────────┼────────────┼─────┘
        │              │               │            │
        ▼              ▼               ▼            ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    ⚡ Wiretap MCP                        │
│                                                         │
│   Terminal      Hermes/CDP      Reactotron    Crash     │
│   Monitor       Monitor         Monitor      Monitor    │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  Claude Code │
                  │              │
                  │  "What went  │
                  │   wrong?"    │
                  └──────────────┘
```

## Tools

| Tool | Description |
|------|-------------|
| `get_terminal_logs` | Metro/Expo terminal output with severity filtering |
| `get_hermes_logs` | JS runtime logs (`console.log/warn/error`) from Hermes via CDP |
| `get_network_calls` | HTTP network calls via CDP, filterable by URL and status code |
| `get_reactotron_logs` | Reactotron logs filtered by type (api, state, log, benchmark) |
| `get_errors` | Consolidated errors from terminal, Reactotron, and Hermes |
| `get_api_calls` | HTTP requests from Reactotron, filterable by endpoint |
| `get_state_changes` | Redux/MobX/Zustand dispatches with before/after diffs |
| `get_native_crashes` | Native crash reports from iOS and Android |
| `get_app_status` | Dashboard with all monitor statuses, error counts, and uptime |
| `get_performance` | Benchmark and render time metrics from Reactotron |
| `search_logs` | Regex search across all log sources |
| `clear_logs` | Reset all buffers |

## Usage

Once installed, just talk to Claude naturally:

```
"What errors happened in the last few minutes?"
"Show me the failing API calls"
"What's the JS console output?"
"Show me the network requests to /api/auth"
"Did the app crash natively?"
"What state changes happened after the login action?"
"Search the logs for 'timeout'"
```

## Configuration

Create a `wiretap.config.json` in your project root. All fields are optional. Defaults work out of the box.

```json
{
  "reactotronPort": 9090,
  "metroPort": 8081,
  "autoDetectTerminal": true
}
```

### All Options

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
| `persistPath` | `~/.wiretap` | Directory for persisted logs |
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

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)