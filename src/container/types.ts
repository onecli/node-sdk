import type { RequestOptions } from "../request-options.js";

export interface CredentialStub {
  containerPath: string;
  content: string;
}

export interface ContainerConfig {
  env: Record<string, string>;
  caCertificate: string;
  caCertificateContainerPath: string;
  credentialStubs?: CredentialStub[];
}

export interface GetContainerConfigOptions extends RequestOptions {
  /**
   * Agent identifier to fetch config for. Uses the default agent if omitted.
   */
  agent?: string;
}

export interface ApplyContainerConfigOptions extends GetContainerConfigOptions {
  /**
   * Build a combined CA bundle (system CAs + OneCLI CA) for full system trust.
   * When enabled, tools like curl, Python, and Go will also trust OneCLI.
   * @default true
   */
  combineCaBundle?: boolean;

  /**
   * Add `--add-host host.docker.internal:host-gateway` on Linux.
   * macOS Docker Desktop provides this mapping automatically.
   * @default true
   */
  addHostMapping?: boolean;
}
