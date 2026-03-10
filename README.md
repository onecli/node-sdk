<h1 align="center">
  <code>@onecli/sdk</code>
</h1>

<p align="center">
  Official Node.js SDK for <a href="https://onecli.sh">OneCLI</a>. Connect AI agents to external services via plugins.
</p>

<p align="center">
  <a href="https://onecli.sh/docs">Documentation</a> &nbsp;|&nbsp;
  <a href="https://onecli.sh">Website</a> &nbsp;|&nbsp;
  <a href="https://github.com/onecli/onecli-sdk">GitHub</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@onecli/sdk">
    <img src="https://img.shields.io/npm/v/@onecli/sdk.svg" alt="npm version" />
  </a>
  <a href="https://github.com/onecli/onecli-sdk/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
  <a href="https://www.npmjs.com/package/@onecli/sdk">
    <img src="https://img.shields.io/node/v/@onecli/sdk.svg" alt="Node.js version" />
  </a>
</p>

---

## What is OneCLI?

**OneCLI** (`oc`) is a thin, agent-first CLI that connects AI agents to external services via plugins. The SDK provides a programmatic interface for Node.js applications to interact with OneCLI, allowing containerized agents to access external APIs without exposing credentials.

## Installation

```bash
npm install @onecli/sdk
```

```bash
pnpm add @onecli/sdk
```

```bash
yarn add @onecli/sdk
```

## Requirements

| SDK version | Node.js version |
| ----------- | --------------- |
| >= 0.1.0    | >= 20           |

## Quick Start

### Standalone function

The simplest way to use the SDK. A single function that configures Docker containers to use OneCLI:

```typescript
import { applyOneCLIConfig } from "@onecli/sdk";

const args = ["run", "-i", "--rm", "--name", "my-agent"];

// Fetches container config and pushes -e / -v flags onto args
const active = await applyOneCLIConfig(args, "http://localhost:18080");

// args now contains OneCLI env vars and volume mounts
console.log(active); // true if OneCLI was reachable
```

### Class-based client

For more control, use the `OneCLI` client class:

```typescript
import { OneCLI } from "@onecli/sdk";

const oc = new OneCLI({
  onecliUrl: "http://localhost:18080",
});

// Get raw container configuration
const config = await oc.client().getContainerConfig();
console.log(config.env);    // { HTTPS_PROXY: "...", NODE_EXTRA_CA_CERTS: "...", ... }
console.log(config.mounts); // [{ hostPath: "...", containerPath: "...", readonly: true }]

// Or apply directly to Docker run args
const args = ["run", "-i", "--rm", "my-image"];
const active = await oc.client().applyContainerConfig(args);
```

### Environment variable

Instead of passing `onecliUrl` explicitly, set the `ONECLI_URL` environment variable:

```bash
export ONECLI_URL=http://localhost:18080
```

```typescript
import { OneCLI } from "@onecli/sdk";

// Automatically reads from ONECLI_URL
const oc = new OneCLI();
const active = await oc.client().applyContainerConfig(args);
```

## API Reference

### `OneCLI`

Main SDK client.

```typescript
new OneCLI(options?: OneCLIOptions)
```

| Option      | Type     | Default                    | Description                     |
| ----------- | -------- | -------------------------- | ------------------------------- |
| `onecliUrl` | `string` | `process.env.ONECLI_URL`   | Base URL of the OneCLI instance |
| `timeout`   | `number` | `5000`                     | Request timeout in milliseconds |

#### `oc.client()`

Returns the `Client` for container configuration. Throws `OneCLIError` if no OneCLI URL is configured.

---

### `Client`

Manages communication with the OneCLI `/container-config` endpoint.

#### `client.getContainerConfig()`

Fetch the raw container configuration from OneCLI.

```typescript
const config = await oc.client().getContainerConfig();
// Returns: { env: Record<string, string>, mounts: ContainerMount[] }
```

**Throws** `OneCLIRequestError` if OneCLI returns a non-200 response.

#### `client.applyContainerConfig(args, options?)`

Fetch the container config and push Docker flags onto the `args` array. Returns `true` if config was applied, `false` if OneCLI was unreachable.

```typescript
const active = await oc.client().applyContainerConfig(args, {
  combineCaBundle: true,  // Merge system + OneCLI CAs (default: true)
  addHostMapping: true,   // Add --add-host on Linux (default: true)
});
```

| Option           | Type      | Default | Description                                           |
| ---------------- | --------- | ------- | ----------------------------------------------------- |
| `combineCaBundle`| `boolean` | `true`  | Build combined CA bundle for system-wide trust         |
| `addHostMapping` | `boolean` | `true`  | Add `host.docker.internal` mapping on Linux            |

**What it does:**
1. Fetches `/container-config` from OneCLI
2. Pushes `-e KEY=VALUE` for each environment variable
3. Pushes `-v host:container[:ro]` for each mount
4. Builds a combined CA bundle (system CAs + OneCLI CA) so all tools trust OneCLI
5. Adds `--add-host host.docker.internal:host-gateway` on Linux

---

### `applyOneCLIConfig(args, onecliUrl?)`

Standalone convenience function. Equivalent to creating a `Client` and calling `applyContainerConfig`.

```typescript
import { applyOneCLIConfig } from "@onecli/sdk";

const active = await applyOneCLIConfig(args, "http://localhost:18080");
// Pass undefined/null to skip (returns false immediately)
```

---

### Error Classes

#### `OneCLIError`

General SDK error.

```typescript
import { OneCLIError } from "@onecli/sdk";

try {
  oc.client(); // throws if no OneCLI URL configured
} catch (error) {
  if (error instanceof OneCLIError) {
    console.error(error.message);
  }
}
```

#### `OneCLIRequestError`

HTTP request error with context.

```typescript
import { OneCLIRequestError } from "@onecli/sdk";

try {
  await oc.client().getContainerConfig();
} catch (error) {
  if (error instanceof OneCLIRequestError) {
    console.error(error.url);        // Request URL
    console.error(error.statusCode); // HTTP status code
    console.error(error.message);    // [URL=...] [StatusCode=...] ...
  }
}
```

---

### Types

All types are exported for use in your own code:

```typescript
import type {
  OneCLIOptions,
  ContainerConfig,
  ContainerMount,
  ApplyContainerConfigOptions,
} from "@onecli/sdk";
```

## How It Works

OneCLI runs on the host machine and acts as a MITM proxy for containerized agents. When a container makes HTTPS requests to intercepted domains (e.g. `api.anthropic.com`), OneCLI:

1. Terminates TLS using a local CA certificate
2. Inspects the request and injects real credentials (replacing placeholder tokens)
3. Forwards the request to the upstream service
4. Returns the response to the container

This means **containers never see real API keys**. They only have placeholder tokens that OneCLI swaps out transparently.

The SDK configures containers with the right environment variables (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`) and volume mounts (OneCLI CA certificate) so this works automatically.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type-check without emitting
npm run typecheck

# Watch mode
npm run dev
```

## License

MIT
