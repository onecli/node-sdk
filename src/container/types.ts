export interface ContainerConfig {
  env: Record<string, string>;
  caCertificate: string;
  caCertificateContainerPath: string;
}

export interface ApplyContainerConfigOptions {
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

  /**
   * Agent identifier to fetch config for. Uses the default agent if omitted.
   */
  agent?: string;
}
