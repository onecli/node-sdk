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

**OneCLI** (`oc`) is a thin, agent-first CLI that connects AI agents to external services via plugins. The SDK provides a programmatic interface for Node.js applications to interact with OneCLI's proxy, allowing containerized agents to access external APIs without exposing credentials.

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

The simplest way to use the SDK. A single function that configures Docker containers to use the OneCLI proxy:

```typescript
import { applyProxyConfig } from "@onecli/sdk";

const args = ["run", "-i", "--rm", "--name", "my-agent"];

// Fetches proxy config and pushes -e / -v flags onto args
const proxyActive = await applyProxyConfig(args, "http://localhost:18080");

// args now contains proxy env vars and volume mounts
console.log(proxyActive); // true if proxy was reachable
```

### Class-based client

For more control, use the `OneCLI` client class:

```typescript
import { OneCLI } from "@onecli/sdk";

const oc = new OneCLI({
  proxyUrl: "http://localhost:18080",
});

// Get raw container configuration
const config = await oc.proxy().getContainerConfig();
console.log(config.env);    // { HTTPS_PROXY: "...", NODE_EXTRA_CA_CERTS: "...", ... }
console.log(config.mounts); // [{ hostPath: "...", containerPath: "...", readonly: true }]

// Or apply directly to Docker run args
const args = ["run", "-i", "--rm", "my-image"];
const active = await oc.proxy().applyContainerConfig(args);
```

### Environment variable

Instead of passing `proxyUrl` explicitly, set the `ONECLI_PROXY_URL` environment variable:

```bash
export ONECLI_PROXY_URL=http://localhost:18080
```

```typescript
import { OneCLI } from "@onecli/sdk";

// Automatically reads from ONECLI_PROXY_URL
const oc = new OneCLI();
const active = await oc.proxy().applyContainerConfig(args);
```

## API Reference

### `OneCLI`

Main SDK client.

```typescript
new OneCLI(options?: OneCLIOptions)
```

| Option     | Type     | Default                          | Description                     |
| ---------- | -------- | -------------------------------- | ------------------------------- |
| `proxyUrl` | `string` | `process.env.ONECLI_PROXY_URL`   | Base URL of the OneCLI proxy    |
| `timeout`  | `number` | `5000`                           | Request timeout in milliseconds |

#### `oc.proxy()`

Returns the `ProxyClient` for container configuration. Throws `OneCLIError` if no proxy URL is configured.

---

### `ProxyClient`

Manages communication with the OneCLI proxy's `/container-config` endpoint.

#### `proxyClient.getContainerConfig()`

Fetch the raw container configuration from the proxy.

```typescript
const config = await oc.proxy().getContainerConfig();
// Returns: { env: Record<string, string>, mounts: ContainerMount[] }
```

**Throws** `OneCLIRequestError` if the proxy returns a non-200 response.

#### `proxyClient.applyContainerConfig(args, options?)`

Fetch the proxy config and push Docker flags onto the `args` array. Returns `true` if config was applied, `false` if the proxy was unreachable.

```typescript
const active = await oc.proxy().applyContainerConfig(args, {
  combineCaBundle: true,  // Merge system + proxy CAs (default: true)
  addHostMapping: true,   // Add --add-host on Linux (default: true)
});
```

| Option           | Type      | Default | Description                                           |
| ---------------- | --------- | ------- | ----------------------------------------------------- |
| `combineCaBundle`| `boolean` | `true`  | Build combined CA bundle for system-wide proxy trust   |
| `addHostMapping` | `boolean` | `true`  | Add `host.docker.internal` mapping on Linux            |

**What it does:**
1. Fetches `/container-config` from the proxy
2. Pushes `-e KEY=VALUE` for each environment variable
3. Pushes `-v host:container[:ro]` for each mount
4. Builds a combined CA bundle (system CAs + proxy CA) so all tools trust the proxy
5. Adds `--add-host host.docker.internal:host-gateway` on Linux

---

### `applyProxyConfig(args, proxyUrl?)`

Standalone convenience function. Equivalent to creating a `ProxyClient` and calling `applyContainerConfig`.

```typescript
import { applyProxyConfig } from "@onecli/sdk";

const active = await applyProxyConfig(args, "http://localhost:18080");
// Pass undefined/null to skip (returns false immediately)
```

---

### Error Classes

#### `OneCLIError`

General SDK error.

```typescript
import { OneCLIError } from "@onecli/sdk";

try {
  oc.proxy(); // throws if no proxy URL configured
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
  await oc.proxy().getContainerConfig();
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

The OneCLI proxy runs on the host machine and acts as a MITM proxy for containerized agents. When a container makes HTTPS requests to intercepted domains (e.g. `api.anthropic.com`), the proxy:

1. Terminates TLS using a local CA certificate
2. Inspects the request and injects real credentials (replacing placeholder tokens)
3. Forwards the request to the upstream service
4. Returns the response to the container

This means **containers never see real API keys**. They only have placeholder tokens that the proxy swaps out transparently.

The SDK configures containers with the right environment variables (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`) and volume mounts (proxy CA certificate) so this works automatically.

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
