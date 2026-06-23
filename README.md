<h1 align="center">
  <code>@onecli-sh/sdk</code>
</h1>

<p align="center">
  Official Node.js SDK for <a href="https://onecli.sh">OneCLI</a>. Route AI agent traffic through the OneCLI gateway — agents never see real credentials.
</p>

<p align="center">
  <a href="https://onecli.sh/docs/sdks/node">Documentation</a> &nbsp;|&nbsp;
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
npm install @onecli-sh/sdk
# or
pnpm add @onecli-sh/sdk
# or
yarn add @onecli-sh/sdk
```

## Requirements

| SDK version | Node.js version |
| ----------- | --------------- |
| >= 0.1.0    | >= 20           |

## Quick Start

```typescript
import { OneCLI } from "@onecli-sh/sdk";

// Cloud (api.onecli.sh) — no url needed, it's the default
const onecli = new OneCLI({
  apiKey: "oc_your_api_key",
});

const args = ["run", "-i", "--rm", "--name", "my-agent"];

// Fetches container config and pushes -e / -v flags onto args
const active = await onecli.applyContainerConfig(args);

// args now contains HTTPS_PROXY, CA certs, and volume mounts
console.log(active); // true if OneCLI was reachable
```

> **Self-hosted?** Pass `url: "http://localhost:10254"` (or wherever your instance runs) to the constructor, or set the `ONECLI_URL` environment variable.

### Environment variables

Instead of passing options explicitly, set environment variables:

```bash
export ONECLI_API_KEY=oc_your_api_key

# Self-hosted only — cloud users can skip this (defaults to https://api.onecli.sh)
# export ONECLI_URL=http://localhost:10254
```

```typescript
import { OneCLI } from "@onecli-sh/sdk";

// Automatically reads from ONECLI_API_KEY (and ONECLI_URL if set)
const onecli = new OneCLI();
const active = await onecli.applyContainerConfig(args);
```

| Variable             | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `ONECLI_API_KEY`     | API key (`oc_...` for project keys, `oc_org_...` for org keys)          |
| `ONECLI_URL`         | Base URL of the OneCLI instance. Defaults to `https://api.onecli.sh`    |
| `ONECLI_GATEWAY_URL` | Gateway URL for manual approval polling (auto-resolved if not set)      |
| `ONECLI_PROJECT_ID`  | Default project ID for org-level API keys                               |

### Organization API keys

Organization-level API keys (`oc_org_...`) grant access across all projects in an org. Pass a `projectId` to specify which project to target.

```typescript
import { OneCLI } from "@onecli-sh/sdk";

// Set a default project for all operations
const onecli = new OneCLI({
  apiKey: "oc_org_your_org_key",
  projectId: "proj-123",
});

await onecli.createAgent({ name: "Bot", identifier: "bot" });

// Override the project for a specific operation
await onecli.createAgent(
  { name: "Bot", identifier: "bot" },
  { projectId: "proj-456" },
);
```

---

## API Reference

### `OneCLI`

Main SDK client.

```typescript
new OneCLI(options?: OneCLIOptions)
```

| Option       | Type     | Default                          | Description                                                            |
| ------------ | -------- | -------------------------------- | ---------------------------------------------------------------------- |
| `apiKey`     | `string` | `ONECLI_API_KEY` env var         | API key (`oc_...` for project keys, `oc_org_...` for org keys)         |
| `url`        | `string` | `ONECLI_URL` or `https://api.onecli.sh` | Base URL of the OneCLI instance                                 |
| `timeout`    | `number` | `5000`                           | Request timeout in milliseconds                                        |
| `gatewayUrl` | `string` | `ONECLI_GATEWAY_URL` env var     | Gateway URL for manual approval polling (auto-resolved if not set)     |
| `projectId`  | `string` | `ONECLI_PROJECT_ID` env var      | Default project ID for org-level API keys (can be overridden per-operation) |

---

### Container configuration

#### `onecli.getContainerConfig(options?)`

Fetch the raw container configuration from OneCLI.

```typescript
const config = await onecli.getContainerConfig();
console.log(config.env);                        // { HTTPS_PROXY: "...", HTTP_PROXY: "...", ... }
console.log(config.caCertificate);              // PEM-formatted CA certificate
console.log(config.caCertificateContainerPath); // /tmp/onecli-proxy-ca.pem

// Fetch config for a specific agent
const agentConfig = await onecli.getContainerConfig({ agent: "my-agent" });

// With org-level API key, specify the target project
const config = await onecli.getContainerConfig({ projectId: "proj-123" });
```

| Option      | Type     | Description                                                              |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `agent`     | `string` | Agent identifier to fetch config for (uses default agent if omitted)     |
| `projectId` | `string` | Project ID override for org-level API keys                               |

**Returns** `{ env, caCertificate, caCertificateContainerPath }`

**Throws** `OneCLIRequestError` on non-200 response.

#### `onecli.applyContainerConfig(args, options?)`

Fetch config and push Docker flags onto the `args` array. Returns `true` on success, or `false` if OneCLI is unreachable or unhealthy (network error or 5xx). Throws `OneCLIRequestError` on a 4xx response (e.g. an unknown agent identifier or invalid API key) — a real misconfiguration you should handle rather than launch an uncredentialed container.

```typescript
const args = ["run", "-i", "--rm", "my-image"];
const active = await onecli.applyContainerConfig(args, {
  combineCaBundle: true,
  addHostMapping: true,
});
```

| Option            | Type      | Default | Description                                    |
| ----------------- | --------- | ------- | ---------------------------------------------- |
| `combineCaBundle` | `boolean` | `true`  | Build combined CA bundle for system-wide trust  |
| `addHostMapping`  | `boolean` | `true`  | Add `host.docker.internal` mapping on Linux     |
| `agent`           | `string`  |         | Agent identifier to fetch config for            |
| `projectId`       | `string`  |         | Project ID override for org-level API keys      |

**What it does:**
1. Fetches container config from OneCLI with Bearer auth
2. Pushes `-e KEY=VALUE` for each environment variable
3. Writes the CA certificate to a temp file and mounts it with `-v`
4. Builds a combined CA bundle (system CAs + OneCLI CA) so all tools trust OneCLI
5. Adds `--add-host host.docker.internal:host-gateway` on Linux

If OneCLI is unreachable or unhealthy (network error or 5xx), returns `false` without mutating the args array. A 4xx response (e.g. the agent identifier isn't registered) throws `OneCLIRequestError` instead of failing silently.

---

### Agent management

#### `onecli.createAgent(input, options?)`

Create a new agent.

```typescript
const agent = await onecli.createAgent({
  name: "My Agent",
  identifier: "my-agent",
});

console.log(agent.id);         // Agent ID
console.log(agent.identifier); // "my-agent"
console.log(agent.createdAt);  // ISO 8601 timestamp
```

| Input        | Type     | Description                                                                  |
| ------------ | -------- | ---------------------------------------------------------------------------- |
| `name`       | `string` | Display name for the agent                                                   |
| `identifier` | `string` | Unique identifier (1-50 chars; lowercase letters, numbers, hyphens; starts with a letter or number) |

**Returns** `{ id, name, identifier, createdAt }`

#### `onecli.listAgents(options?)`

List all agents in the project.

```typescript
const agents = await onecli.listAgents();

for (const agent of agents) {
  console.log(agent.identifier, agent.isDefault);
}
```

**Returns** `Array<{ id, name, identifier, isDefault, createdAt }>`

#### `onecli.ensureAgent(input, options?)`

Ensure an agent exists. Creates it if missing, returns normally if it already exists.

```typescript
const result = await onecli.ensureAgent({
  name: "My Agent",
  identifier: "my-agent",
});

console.log(result.created); // true if newly created, false if already existed
```

Idempotent even at the agent cap: if the project is at its plan's agent limit but the target identifier already exists, the call still resolves with `created: false` instead of throwing a quota error.

**Returns** `{ name, identifier, created }`

---

### Project provisioning

> **Cloud-only feature.** Calling `provisionProject()` against an OSS instance throws `OneCLIError`.

#### `onecli.provisionProject(input?, options?)`

Pre-create a user account with a project and API key. The API key works immediately. Requires admin or owner role.

```typescript
const result = await onecli.provisionProject({
  role: "member",
  skipOnboarding: true,
});

console.log(result.apiKey);    // oc_... (usable immediately)
console.log(result.claimUrl);  // https://app.onecli.sh/claim?token=...
console.log(result.projectId);
```

| Input            | Type                  | Default    | Description                                   |
| ---------------- | --------------------- | ---------- | --------------------------------------------- |
| `role`           | `"admin" \| "member"` | `"member"` | Role the provisioned user will have in the org |
| `skipOnboarding` | `boolean`             | `true`     | Whether the user skips the onboarding wizard   |

**Returns**

| Field       | Type     | Description                                              |
| ----------- | -------- | -------------------------------------------------------- |
| `id`        | `string` | Provision record ID                                      |
| `userId`    | `string` | Placeholder user ID (becomes the real user after claim)  |
| `projectId` | `string` | Pre-created project ID                                   |
| `apiKey`    | `string` | API key for the provisioned project (usable immediately) |
| `claimUrl`  | `string` | URL the user visits to claim the account                 |
| `expiresAt` | `string` | Expiration timestamp (ISO 8601)                          |

**Throws** `OneCLIError` if called against an OSS instance. **Throws** `OneCLIRequestError` with status 403 if the API key doesn't belong to an admin/owner.

---

### Manual approval

#### `onecli.configureManualApproval(callback, options?)`

Register a callback that's invoked whenever an agent request needs human approval. Starts background long-polling to the gateway. Returns a handle to stop polling.

```typescript
const handle = onecli.configureManualApproval(async (request) => {
  console.log(`${request.method} ${request.url}`);
  console.log(`Agent: ${request.agent.name}`);

  // `summary` is a structured, human-readable description of the request
  // (e.g. a Gmail send's base64 body decoded into To/Subject/Body).
  // `bodyPreview` is the same content flattened to text — safe to display directly.
  if (request.summary) {
    console.log(request.summary.action); // e.g. "Send email"
    for (const { label, value } of request.summary.details) {
      console.log(`${label}: ${value}`); // e.g. "To: a@b.com"
    }
  } else if (request.bodyPreview) {
    console.log(request.bodyPreview);
  }

  // Return 'approve' to forward the request, 'deny' to block it
  return "approve";
});

// Stop polling on shutdown
process.on("SIGTERM", () => handle.stop());
```

The callback is called once per pending approval. Multiple approvals are handled concurrently, and each callback runs independently. If the callback throws or the decision fails to submit, the same request is retried on the next poll cycle.

**Callback parameter: `ApprovalRequest`**

| Field            | Type                                                        | Description                                       |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `id`             | `string`                                                    | Unique approval ID                                |
| `method`         | `string`                                                    | HTTP method (`GET`, `POST`, `DELETE`, etc.)        |
| `url`            | `string`                                                    | Full request URL                                  |
| `host`           | `string`                                                    | Hostname                                          |
| `path`           | `string`                                                    | Request path                                      |
| `headers`        | `Record<string, string>`                                    | Sanitized request headers (no credentials)        |
| `bodyPreview`    | `string \| null`                                            | Human-readable text rendering of the request, safe to display |
| `summary`        | `ApprovalSummary \| null` (optional)                        | Structured form of `bodyPreview` (see below); may be absent on older gateways |
| `agent`          | `{ id: string; name: string; externalId: string \| null }`  | The agent that made the request                   |
| `createdAt`      | `string`                                                    | When the request arrived (ISO 8601)               |
| `expiresAt`      | `string`                                                    | When the approval expires (ISO 8601)              |
| `timeoutSeconds` | `number`                                                    | Seconds until auto-deny (300)                     |

Where `ApprovalSummary` is:

```typescript
interface ApprovalSummary {
  action: string; // e.g. "Send email"
  details: { label: string; value: string }[]; // e.g. [{ label: "To", value: "a@b.com" }]
}
```

**Returns** `ManualApprovalHandle` with a `stop()` method to disconnect.

---

### Error classes

#### `OneCLIError`

General SDK error (e.g., missing API key).

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

All types are exported for use in your own code:

```typescript
import type {
  OneCLIOptions,
  RequestOptions,
  ContainerConfig,
  GetContainerConfigOptions,
  ApplyContainerConfigOptions,
  CreateAgentInput,
  CreateAgentResponse,
  EnsureAgentResponse,
  ApprovalRequest,
  ManualApprovalCallback,
  ManualApprovalHandle,
  ProvisionProjectInput,
  ProvisionProjectResponse,
} from "@onecli-sh/sdk";
```

## How It Works

OneCLI runs on the host machine and acts as a gateway for containerized agents. When a container makes HTTPS requests to intercepted domains (e.g. `api.anthropic.com`), OneCLI:

1. Terminates TLS using a local CA certificate
2. Inspects the request and injects real credentials (replacing placeholder tokens)
3. Forwards the request to the upstream service
4. Returns the response to the container

**Containers never see real API keys.** They only have placeholder tokens that OneCLI swaps out transparently.

The SDK configures containers with the right environment variables (`HTTPS_PROXY`, `HTTP_PROXY`) and CA certificate mounts so this works automatically.

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
