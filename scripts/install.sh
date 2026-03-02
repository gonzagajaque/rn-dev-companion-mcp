#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Installing dependencies..."
cd "$PROJECT_DIR"
npm install

echo "==> Building project..."
npm run build

echo "==> Registering MCP server in Claude Code..."
claude mcp add rn-dev-companion -- node "$PROJECT_DIR/dist/index.js"

echo ""
echo "Done! rn-dev-companion MCP server installed."
echo "Restart Claude Code to use the new tools."
echo ""
echo "Available tools (12):"
echo "  - get_terminal_logs    Get Metro/Expo terminal logs"
echo "  - get_reactotron_logs  Get Reactotron logs"
echo "  - get_hermes_logs      Get JS runtime logs from Hermes/CDP"
echo "  - get_network_calls    Get HTTP network calls via CDP"
echo "  - get_errors           Get consolidated errors/crashes"
echo "  - get_api_calls        Get API calls from Reactotron"
echo "  - get_state_changes    Get state changes from Reactotron"
echo "  - get_native_crashes   Get native crash reports (iOS/Android)"
echo "  - get_app_status       Get overall app status"
echo "  - get_performance      Get performance metrics"
echo "  - search_logs          Full-text search across all logs"
echo "  - clear_logs           Clear all log buffers"
