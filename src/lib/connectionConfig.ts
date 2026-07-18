import type { DialectConfig, SshTunnelConfig } from '@/stores/dbList';

/** Sensitive fields that must never be written to connections.json or plain export files. */
export const SENSITIVE_KEYS = [
  'password',
  'ssh_password',
  'ssh_passphrase',
  'token',
] as const;

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

export type ConnectionSecrets = {
  password?: string;
  ssh_password?: string;
  ssh_passphrase?: string;
  token?: string;
};

/** Legacy flat SSH fields (pre nested `ssh_tunnel`). */
type LegacySshFlat = {
  ssh_enabled?: boolean;
  ssh_host?: string;
  ssh_port?: string;
  ssh_username?: string;
  ssh_password?: string;
  ssh_private_key_path?: string;
  ssh_passphrase?: string;
  ssh_config_host?: string;
};

const LEGACY_SSH_KEYS = [
  'ssh_enabled',
  'ssh_host',
  'ssh_port',
  'ssh_username',
  'ssh_password',
  'ssh_private_key_path',
  'ssh_passphrase',
  'ssh_config_host',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function legacyFlatToTunnel(flat: LegacySshFlat): SshTunnelConfig | undefined {
  const hasAny =
    flat.ssh_enabled != null ||
    flat.ssh_host != null ||
    flat.ssh_port != null ||
    flat.ssh_username != null ||
    flat.ssh_password != null ||
    flat.ssh_private_key_path != null ||
    flat.ssh_passphrase != null ||
    flat.ssh_config_host != null;
  if (!hasAny) {
    return undefined;
  }
  return {
    enabled: flat.ssh_enabled,
    host: flat.ssh_host,
    port: flat.ssh_port,
    username: flat.ssh_username,
    password: flat.ssh_password,
    private_key_path: flat.ssh_private_key_path,
    passphrase: flat.ssh_passphrase,
    config_host: flat.ssh_config_host,
  };
}

function stripLegacySshKeys(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...record };
  for (const key of LEGACY_SSH_KEYS) {
    delete next[key];
  }
  return next;
}

/** Normalize stored/imported config: flat `ssh_*` → nested `ssh_tunnel`. */
export function normalizeDialectConfig<
  T extends DialectConfig | undefined | null,
>(config: T): T {
  if (!config) {
    return config;
  }
  if (config.dialect !== 'mysql' && config.dialect !== 'postgres') {
    return config;
  }

  const record = config as Record<string, unknown> & LegacySshFlat;
  const existing = isRecord(record.ssh_tunnel)
    ? (record.ssh_tunnel as SshTunnelConfig)
    : undefined;
  const fromLegacy = legacyFlatToTunnel(record);
  const ssh_tunnel = existing
    ? {
        ...fromLegacy,
        ...existing,
        password: existing.password ?? fromLegacy?.password,
        passphrase: existing.passphrase ?? fromLegacy?.passphrase,
      }
    : fromLegacy;

  const next = stripLegacySshKeys({ ...record }) as Record<string, unknown>;
  if (ssh_tunnel) {
    next.ssh_tunnel = ssh_tunnel;
  } else {
    delete next.ssh_tunnel;
  }
  return next as T;
}

/** Flatten nested `ssh_tunnel` into backend DialectPayload `ssh_*` fields. */
export function flattenSshTunnelForBackend(
  config: DialectConfig | undefined | null,
): Record<string, unknown> {
  const normalized = normalizeDialectConfig(config);
  if (!normalized) {
    return {};
  }
  const record = { ...(normalized as Record<string, unknown>) };
  const tunnel = isRecord(record.ssh_tunnel)
    ? (record.ssh_tunnel as SshTunnelConfig)
    : undefined;
  delete record.ssh_tunnel;

  if (tunnel) {
    record.ssh_enabled = tunnel.enabled;
    record.ssh_host = tunnel.host;
    record.ssh_port = tunnel.port;
    record.ssh_username = tunnel.username;
    record.ssh_password = tunnel.password;
    record.ssh_private_key_path = tunnel.private_key_path;
    record.ssh_passphrase = tunnel.passphrase;
  }
  return record;
}

export function pickSecrets(
  config: DialectConfig | undefined | null,
): ConnectionSecrets {
  if (!config) {
    return {};
  }
  const normalized = normalizeDialectConfig(config);
  const record = normalized as Record<string, unknown>;
  const tunnel = isRecord(record.ssh_tunnel)
    ? (record.ssh_tunnel as SshTunnelConfig)
    : undefined;

  const secrets: ConnectionSecrets = {};
  const password = nonEmptyString(record.password);
  if (password) {
    secrets.password = password;
  }
  const token = nonEmptyString(record.token);
  if (token) {
    secrets.token = token;
  }
  const sshPassword =
    nonEmptyString(tunnel?.password) ?? nonEmptyString(record.ssh_password);
  if (sshPassword) {
    secrets.ssh_password = sshPassword;
  }
  const sshPassphrase =
    nonEmptyString(tunnel?.passphrase) ??
    nonEmptyString(record.ssh_passphrase);
  if (sshPassphrase) {
    secrets.ssh_passphrase = sshPassphrase;
  }
  return secrets;
}

export function stripSecrets<T extends DialectConfig | undefined | null>(
  config: T,
): T {
  if (!config) {
    return config;
  }
  const normalized = normalizeDialectConfig(config);
  const next = { ...(normalized as Record<string, unknown>) };
  delete next.password;
  delete next.token;
  delete next.ssh_password;
  delete next.ssh_passphrase;

  if (isRecord(next.ssh_tunnel)) {
    const tunnel = { ...(next.ssh_tunnel as SshTunnelConfig) };
    delete tunnel.password;
    delete tunnel.passphrase;
    next.ssh_tunnel = tunnel;
  }
  return next as T;
}

export function mergeSecrets(
  config: DialectConfig | undefined,
  secrets: ConnectionSecrets | null | undefined,
): DialectConfig | undefined {
  if (!config) {
    return config;
  }
  const normalized = normalizeDialectConfig(config);
  if (!secrets) {
    return normalized ?? config;
  }
  const next = { ...(normalized as Record<string, unknown>) };
  if (nonEmptyString(secrets.password)) {
    next.password = secrets.password;
  }
  if (nonEmptyString(secrets.token)) {
    next.token = secrets.token;
  }

  const hasSshSecret =
    nonEmptyString(secrets.ssh_password) ||
    nonEmptyString(secrets.ssh_passphrase);
  if (hasSshSecret) {
    const tunnel = isRecord(next.ssh_tunnel)
      ? { ...(next.ssh_tunnel as SshTunnelConfig) }
      : ({} as SshTunnelConfig);
    if (nonEmptyString(secrets.ssh_password)) {
      tunnel.password = secrets.ssh_password;
    }
    if (nonEmptyString(secrets.ssh_passphrase)) {
      tunnel.passphrase = secrets.ssh_passphrase;
    }
    next.ssh_tunnel = tunnel;
  }

  return next as DialectConfig;
}

/** True when the object still contains any sensitive key with a non-empty string. */
export function hasPlaintextSecrets(value: unknown): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasPlaintextSecrets);
  }
  const record = value as Record<string, unknown>;
  for (const key of SENSITIVE_KEYS) {
    if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
      return true;
    }
  }
  // Nested tunnel secrets use password/passphrase without ssh_ prefix.
  if (isRecord(record.ssh_tunnel)) {
    const tunnel = record.ssh_tunnel as SshTunnelConfig;
    if (nonEmptyString(tunnel.password) || nonEmptyString(tunnel.passphrase)) {
      return true;
    }
  }
  return Object.values(record).some(hasPlaintextSecrets);
}

/**
 * When editing a connection: empty secret fields mean "keep existing".
 * Non-empty values replace; explicit clearSecrets drops stored secrets.
 */
export function resolveSecretsForSave(options: {
  nextConfig: DialectConfig;
  previousConfig?: DialectConfig;
  clearSecrets?: boolean;
}): ConnectionSecrets {
  if (options.clearSecrets) {
    return {};
  }
  const previous = pickSecrets(options.previousConfig);
  const incoming = pickSecrets(options.nextConfig);
  return {
    password: incoming.password ?? previous.password,
    ssh_password: incoming.ssh_password ?? previous.ssh_password,
    ssh_passphrase: incoming.ssh_passphrase ?? previous.ssh_passphrase,
    token: incoming.token ?? previous.token,
  };
}

export function secretsAreEmpty(secrets: ConnectionSecrets): boolean {
  return SENSITIVE_KEYS.every((key) => !secrets[key]);
}
