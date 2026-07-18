import type { DialectConfig } from '@/stores/dbList';

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

export function pickSecrets(
  config: DialectConfig | undefined | null,
): ConnectionSecrets {
  if (!config) {
    return {};
  }
  const record = config as Record<string, unknown>;
  const secrets: ConnectionSecrets = {};
  for (const key of SENSITIVE_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      secrets[key] = value;
    }
  }
  return secrets;
}

export function stripSecrets<T extends DialectConfig | undefined | null>(
  config: T,
): T {
  if (!config) {
    return config;
  }
  const next = { ...config } as Record<string, unknown>;
  for (const key of SENSITIVE_KEYS) {
    delete next[key];
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
  if (!secrets) {
    return config;
  }
  const next = { ...config } as Record<string, unknown>;
  for (const key of SENSITIVE_KEYS) {
    const value = secrets[key];
    if (typeof value === 'string' && value.length > 0) {
      next[key] = value;
    }
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
