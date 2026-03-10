export interface ContainerMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

export interface ContainerConfig {
  env: Record<string, string>;
  mounts: ContainerMount[];
}

export interface ApplyContainerConfigOptions {
  /**
   * Build a combined CA bundle (system CAs + proxy CA) for full system trust.
   * When enabled, tools like curl, Python, and Go will also trust the proxy.
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
