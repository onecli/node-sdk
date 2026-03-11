<h1 align="center">
  <code>@onecli-sh/sdk</code>
</h1>

<p align="center">
  Official Node.js SDK for <a href="https://onecli.sh">OneCLI</a>. Route AI agent traffic through the OneCLI proxy — agents never see real credentials.
</p>

<p align="center">
  <a href="https://onecli.sh/docs">Documentation</a> &nbsp;|&nbsp;
  <a href="https://onecli.sh">Website</a> &nbsp;|&nbsp;
  <a href="https://github.com/onecli/node-sdk">GitHub</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@onecli-sh/sdk">
    <img src="https://img.shields.io/npm/v/@onecli-sh/sdk.svg" alt="npm version" />
  </a>
  <a href="https://github.com/onecli/node-sdk/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
  <a href="https://www.npmjs.com/package/@onecli-sh/sdk">
    <img src="https://img.shields.io/node/v/@onecli-sh/sdk.svg" alt="Node.js version" />
  </a>
</p>

---

## Installation

```bash
pnpm add @onecli-sh/sdk
```

## Requirements

| SDK version | Node.js version |
| ----------- | --------------- |
| >= 0.1.0    | >= 20           |

## Quick Start

```typescript
import { OneCLI } from "@onecli-sh/sdk";

// Reads ONECLI_API_KEY and ONECLI_URL from environment
const onecli = new OneCLI();

const args = ["run", "-i", "--rm", "--name", "my-agent"];
const active = await onecli.applyContainerConfig(args);
// args now contains proxy env vars and CA certificate mounts
console.log(active); // true if OneCLI was reachable
```

### Explicit configuration

```typescript
import { OneCLI } from "@onecli-sh/sdk";

const onecli = new OneCLI({
  apiKey: "oc_...",                    // optional: falls back to ONECLI_API_KEY env var
  url: "http://localhost:3000",        // optional: falls back to ONECLI_URL env var, then https://app.onecli.sh
});

// Get raw container configuration
const config = await onecli.getContainerConfig();
console.log(config.env);              // { HTTPS_PROXY: "...", HTTP_PROXY: "...", ... }
console.log(config.caCertificate);    // PEM content

// Or apply directly to Docker run args
const args = ["run", "-i", "--rm", "my-image"];
const active = await onecli.applyContainerConfig(args);
```

### Environment variables

| Variable         | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `ONECLI_API_KEY` | User API key (`oc_...`). Used when `apiKey` is not passed to constructor. |
| `ONECLI_URL`     | Base URL of OneCLI instance. Defaults to `https://app.onecli.sh`. |

## API Reference

### `OneCLI`

Main SDK client.

```typescript
new OneCLI(options?: OneCLIOptions)
```

| Option    | Type     | Required | Default                             | Description                     |
| --------- | -------- | -------- | ----------------------------------- | ------------------------------- |
| `apiKey`  | `string` | No       | `ONECLI_API_KEY` env var            | User API key (`oc_...`)         |
| `url`     | `string` | No       | `ONECLI_URL` or `https://app.onecli.sh` | Base URL of the OneCLI instance |
| `timeout` | `number` | No       | `5000`                              | Request timeout in milliseconds |

#### `onecli.getContainerConfig()`

Fetch the raw container configuration from OneCLI.

```typescript
const config = await onecli.getContainerConfig();
// Returns: { env, caCertificate, caCertificateContainerPath }
```

**Throws** `OneCLIRequestError` on non-200 response.

#### `onecli.applyContainerConfig(args, options?)`

Fetch config and push Docker flags onto the `args` array. Returns `true` on success, `false` on failure (graceful degradation).

```typescript
const active = await onecli.applyContainerConfig(args, {
  combineCaBundle: true,  // Merge system + OneCLI CAs (default: true)
  addHostMapping: true,   // Add --add-host on Linux (default: true)
});
```

| Option           | Type      | Default | Description                                    |
| ---------------- | --------- | ------- | ---------------------------------------------- |
| `combineCaBundle`| `boolean` | `true`  | Build combined CA bundle for system-wide trust  |
| `addHostMapping` | `boolean` | `true`  | Add `host.docker.internal` mapping on Linux     |

**What it does:**
1. Fetches `/api/container-config` with `Authorization: Bearer {apiKey}`
2. Pushes `-e KEY=VALUE` for each server-controlled environment variable
3. Writes CA certificate to a temp file and mounts it into the container
4. Builds a combined CA bundle (system CAs + OneCLI CA) so curl, Python, Go, etc. also trust OneCLI
5. Adds `--add-host host.docker.internal:host-gateway` on Linux

---

### Error Classes

#### `OneCLIError`

General SDK error (e.g. missing `apiKey`).

```typescript
import { OneCLIError } from "@onecli-sh/sdk";
```

#### `OneCLIRequestError`

HTTP request error with `url` and `statusCode` properties.

```typescript
import { OneCLIRequestError } from "@onecli-sh/sdk";

try {
  await onecli.getContainerConfig();
} catch (error) {
  if (error instanceof OneCLIRequestError) {
    console.error(error.url);        // Request URL
    console.error(error.statusCode); // HTTP status code
  }
}
```

---

### Types

```typescript
import type {
  OneCLIOptions,
  ContainerConfig,
  ApplyContainerConfigOptions,
} from "@onecli-sh/sdk";
```

## How It Works

OneCLI acts as a MITM proxy for containerized agents. When a container makes HTTPS requests to intercepted domains (e.g. `api.anthropic.com`), OneCLI:

1. Terminates TLS using a local CA certificate
2. Inspects the request and injects real credentials
3. Forwards the request to the upstream service

**Containers never see real API keys.** The SDK configures containers with the right environment variables (`HTTPS_PROXY`, `HTTP_PROXY`, `NODE_EXTRA_CA_CERTS`) and CA certificate mounts so this works automatically.

## Development

```bash
pnpm install       # Install dependencies
pnpm run build     # Build CJS + ESM
pnpm run typecheck # Type-check without emitting
pnpm run test      # Run tests
pnpm run dev       # Watch mode
```

## License

MIT
