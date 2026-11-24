# Installation and configuration

Install Node.js 22.13 or later. Clone the repository, run `npm ci` and build with `npm run build`. Keep the checkout in a stable location so the MCP client can resolve the entry point.

## Codex

On macOS or Linux, run this from the checkout.

```sh
codex mcp add flight-search -- node "$(pwd)/dist/index.js"
codex mcp get flight-search
```

On PowerShell, use the resolved path.

```powershell
$entry = (Resolve-Path .\dist\index.js).Path
codex mcp add flight-search -- node "$entry"
codex mcp get flight-search
```

Start a new session and ask Codex to call `list_providers`. To remove the registration, run `codex mcp remove flight-search`.

## Generic stdio client

Use your client’s MCP configuration file and substitute the absolute path to the built entry point.

```json
{
  "mcpServers": {
    "flight-search": {
      "command": "node",
      "args": ["/absolute/path/to/flight-search-mcp/dist/index.js"]
    }
  }
}
```

If the client is launched from a desktop icon and cannot locate Node, set `command` to the full path of the Node executable.

## Bundled Codex plugin

The repository includes a local marketplace, plugin manifest and flight-planning skill. Use this setup in place of the standalone MCP registration when you want the skill too.

1. Build the checkout and run `npm link` from its root.
2. Confirm `flight-search-mcp` is on the PATH used by Codex.
3. Run `codex plugin marketplace add "$(pwd)"` on macOS or Linux. On PowerShell use `codex plugin marketplace add (Get-Location).Path`.
4. In Codex, install **Flight Search** from **Flight Search Local**. Start a new session and call `list_providers`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `FLIGHT_STATE_DIR` | Override the directory for the SQLite price-watch database. The default is `~/.local/share/flight-search-mcp`. |
| `FLIGHT_SKYSCANNER_KEY` | Optional existing Skyscanner partner API key. Select the provider explicitly when searching. Keep the key in client environment configuration. |

A server launches over stdio and exposes no web port. If it fails to start, check `node --version`, rebuild, verify the absolute entry point, and inspect the client’s MCP logs. Flight providers can limit requests. A fast search with partial coverage can still contain useful offers. [Source coverage](sources.md)

## Local price watches

Use `save_price_watch` to save an itinerary and a price threshold in SQLite. Run a one-time check with:

```sh
node dist/index.js --poll-price-alerts
```

A price crossing the threshold emits a JSON record. On macOS, add `--notify-macos` to display a system notification. To schedule two daily checks, run the following from the permanent checkout directory.

```sh
mkdir -p "$HOME/Library/LaunchAgents"
node dist/index.js --print-macos-launch-agent > "$HOME/Library/LaunchAgents/org.flight-search.price-alerts.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/org.flight-search.price-alerts.plist"
```

The checks run while the Mac is on and the user session is active. To unload the launch agent, run `launchctl bootout "gui/$(id -u)/org.flight-search.price-alerts"`.
