import { nanoid } from 'nanoid';

import {
  hasPlaintextSecrets,
  normalizeDialectConfig,
  pickSecrets,
  stripSecrets,
  type ConnectionSecrets,
} from '@/lib/connectionConfig';
import type { DialectConfig, DialectType } from '@/stores/dbList';

export const CONNECTIONS_EXPORT_FORMAT = 'duckling.connections';
export const CONNECTIONS_EXPORT_VERSION = 1;

export type ConnectionProfile = {
  id: string;
  displayName: string;
  dialect: DialectType;
  config?: DialectConfig;
  createdAt?: number;
  updatedAt?: number;
};

export type ConnectionsExportFile = {
  format: typeof CONNECTIONS_EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  includeSecrets: boolean;
  connections: ConnectionProfile[];
  /** Present only when includeSecrets is true (P2.1). */
  kdf?: string;
  crypto?: string;
  salt?: string;
  nonce?: string;
  secretsBlob?: string;
};

export type ImportConnectionItem = {
  id: string;
  displayName: string;
  dialect: DialectType;
  config: DialectConfig;
  secrets: ConnectionSecrets;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function toConnectionProfile(input: {
  id: string;
  displayName: string;
  dialect: DialectType;
  config?: DialectConfig;
  createdAt?: number;
  updatedAt?: number;
}): ConnectionProfile {
  return {
    id: input.id,
    displayName: input.displayName,
    dialect: input.dialect,
    config: input.config
      ? stripSecrets(normalizeDialectConfig(input.config))
      : undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function buildPlainExport(
  profiles: ConnectionProfile[],
): ConnectionsExportFile {
  const file: ConnectionsExportFile = {
    format: CONNECTIONS_EXPORT_FORMAT,
    version: CONNECTIONS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    includeSecrets: false,
    connections: profiles.map((p) => ({
      ...p,
      config: p.config
        ? stripSecrets(normalizeDialectConfig(p.config))
        : undefined,
    })),
  };
  if (hasPlaintextSecrets(file)) {
    throw new Error('Refusing to export plaintext secrets');
  }
  return file;
}

export function collectSecretsById(
  items: Array<{ id: string; config?: DialectConfig }>,
): Record<string, ConnectionSecrets> {
  const byId: Record<string, ConnectionSecrets> = {};
  for (const item of items) {
    const secrets = pickSecrets(item.config);
    if (Object.keys(secrets).length > 0) {
      byId[item.id] = secrets;
    }
  }
  return byId;
}

export function parseConnectionsExport(raw: string): ConnectionsExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!isRecord(parsed)) {
    throw new Error('Invalid export file');
  }
  if (parsed.format !== CONNECTIONS_EXPORT_FORMAT) {
    throw new Error(`Unsupported format: ${String(parsed.format)}`);
  }
  if (parsed.version !== CONNECTIONS_EXPORT_VERSION) {
    throw new Error(`Unsupported version: ${String(parsed.version)}`);
  }
  if (!Array.isArray(parsed.connections)) {
    throw new Error('Missing connections array');
  }

  const connections: ConnectionProfile[] = parsed.connections.map(
    (item, index) => {
      if (!isRecord(item)) {
        throw new Error(`Invalid connection at index ${index}`);
      }
      if (typeof item.id !== 'string' || !item.id) {
        throw new Error(`Connection at index ${index} is missing id`);
      }
      if (typeof item.displayName !== 'string') {
        throw new Error(`Connection at index ${index} is missing displayName`);
      }
      if (typeof item.dialect !== 'string') {
        throw new Error(`Connection at index ${index} is missing dialect`);
      }
      const config = item.config as DialectConfig | undefined;
      return {
        id: item.id,
        displayName: item.displayName,
        dialect: item.dialect as DialectType,
        config: config
          ? stripSecrets(normalizeDialectConfig(config))
          : undefined,
        createdAt:
          typeof item.createdAt === 'number' ? item.createdAt : undefined,
        updatedAt:
          typeof item.updatedAt === 'number' ? item.updatedAt : undefined,
      };
    },
  );

  const includeSecrets = Boolean(parsed.includeSecrets);
  if (!includeSecrets && hasPlaintextSecrets(connections)) {
    throw new Error('Export file contains plaintext secrets');
  }

  return {
    format: CONNECTIONS_EXPORT_FORMAT,
    version: CONNECTIONS_EXPORT_VERSION,
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date().toISOString(),
    includeSecrets,
    connections,
    kdf: typeof parsed.kdf === 'string' ? parsed.kdf : undefined,
    crypto: typeof parsed.crypto === 'string' ? parsed.crypto : undefined,
    salt: typeof parsed.salt === 'string' ? parsed.salt : undefined,
    nonce: typeof parsed.nonce === 'string' ? parsed.nonce : undefined,
    secretsBlob:
      typeof parsed.secretsBlob === 'string' ? parsed.secretsBlob : undefined,
  };
}

/** Assign new ids so import never overwrites existing connections by id. */
export function mapImportProfiles(
  file: ConnectionsExportFile,
  secretsByExportId: Record<string, ConnectionSecrets> = {},
): ImportConnectionItem[] {
  return file.connections.map((profile) => {
    const secrets = secretsByExportId[profile.id] ?? {};
    const baseConfig = normalizeDialectConfig(
      (profile.config ?? {
        dialect: profile.dialect,
      }) as DialectConfig,
    );
    return {
      id: nanoid(),
      displayName: profile.displayName.includes('(imported)')
        ? profile.displayName
        : `${profile.displayName} (imported)`,
      dialect: profile.dialect,
      config: stripSecrets(baseConfig),
      secrets,
    };
  });
}
