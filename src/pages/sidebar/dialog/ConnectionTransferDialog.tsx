import { Trans, useLingui } from '@lingui/react/macro';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  connectionsExportEncrypt,
  connectionsImportDecrypt,
  readTextFile,
  writeTextFile,
} from '@/api';
import { Dialog } from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  buildPlainExport,
  mapImportProfiles,
  parseConnectionsExport,
  toConnectionProfile,
  type ConnectionsExportFile,
} from '@/lib/connectionTransfer';
import { DBType, useDBListStore } from '@/stores/dbList';

type Mode = 'export' | 'import';

export function ConnectionTransferDialog({
  mode,
  open,
  onOpenChange,
  /** When set, export only this connection; otherwise export all. */
  only,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  only?: DBType;
}) {
  const { t } = useLingui();
  const dbList = useDBListStore((s) => s.dbList);
  const importConnections = useDBListStore((s) => s.importConnections);

  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setIncludeSecrets(false);
    setPassword('');
    setPasswordConfirm('');
    setBusy(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const sources = only ? [only] : dbList;

  async function handleExport() {
    if (sources.length === 0) {
      toast.error(t`No connections to export`);
      return;
    }
    if (includeSecrets) {
      if (!password.trim()) {
        toast.error(t`Password is required`);
        return;
      }
      if (password !== passwordConfirm) {
        toast.error(t`Passwords do not match`);
        return;
      }
    }

    const path = await dialog.save({
      defaultPath: only
        ? `${only.displayName || 'connection'}.duckling-connections.json`
        : 'connections.duckling-connections.json',
      filters: [
        {
          name: 'Duckling Connections',
          extensions: ['json', 'duckling-connections.json'],
        },
      ],
    });
    if (!path) {
      return;
    }

    setBusy(true);
    try {
      const profiles = sources.map((db) =>
        toConnectionProfile({
          id: db.id,
          displayName: db.displayName,
          dialect: db.dialect,
          config: db.config,
        }),
      );

      let payload: ConnectionsExportFile | Awaited<
        ReturnType<typeof connectionsExportEncrypt>
      >;

      if (includeSecrets) {
        // Secrets live in backend vault/keychain — load via secret_get.
        const { getConnectionSecrets } = await import('@/stores/secretStore');
        const secretsById: Record<string, Record<string, string | undefined>> =
          {};
        for (const db of sources) {
          const secrets = await getConnectionSecrets(db.id);
          if (secrets && Object.keys(secrets).length > 0) {
            secretsById[db.id] = secrets;
          }
        }
        payload = await connectionsExportEncrypt(
          profiles,
          secretsById,
          password,
        );
      } else {
        payload = buildPlainExport(profiles);
      }

      await writeTextFile(path, JSON.stringify(payload, null, 2));
      toast.success(
        includeSecrets
          ? t`Exported connections with encrypted secrets`
          : t`Exported connections (passwords not included)`,
      );
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t`Export failed`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    const selected = await dialog.open({
      multiple: false,
      filters: [
        {
          name: 'Duckling Connections',
          extensions: ['json', 'duckling-connections.json'],
        },
      ],
    });
    if (!selected || Array.isArray(selected)) {
      return;
    }

    setBusy(true);
    try {
      const raw = await readTextFile(selected);
      const file = parseConnectionsExport(raw);

      let secretsById: Record<string, { password?: string }> = {};
      if (file.includeSecrets) {
        if (!password.trim()) {
          toast.error(t`Password is required to import encrypted secrets`);
          setBusy(false);
          return;
        }
        secretsById = await connectionsImportDecrypt(file, password);
      }

      const items = mapImportProfiles(file, secretsById);
      await importConnections(items);
      toast.success(
        file.includeSecrets
          ? t`Imported connections with secrets`
          : t`Imported connections. Re-enter passwords if needed.`,
      );
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t`Import failed`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={mode === 'export' ? t`Export Connections` : t`Import Connections`}
      className="min-w-[480px]"
    >
      <div className="space-y-4 py-2">
        {mode === 'export' ? (
          <>
            <p className="text-sm text-muted-foreground">
              {only
                ? t`Export this connection to a JSON file.`
                : t`Export all connections to a JSON file.`}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label>
                  <Trans>Include passwords (encrypted)</Trans>
                </Label>
                <p className="text-xs text-muted-foreground">
                  <Trans>
                    Protect secrets with a master password. Without this option,
                    passwords are not exported.
                  </Trans>
                </p>
              </div>
              <Switch
                checked={includeSecrets}
                onCheckedChange={setIncludeSecrets}
              />
            </div>
            {includeSecrets ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>
                    <Trans>Master password</Trans>
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    <Trans>Confirm password</Trans>
                  </Label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <Trans>
                Import connections from a Duckling export file. Existing
                connections are not overwritten; imported items get new ids.
              </Trans>
            </p>
            <div className="space-y-1">
              <Label>
                <Trans>Master password (if file is encrypted)</Trans>
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                placeholder={t`Leave empty for plain exports`}
              />
            </div>
          </>
        )}
      </div>
      <DialogFooter>
        <DialogClose
          render={
            <Button variant="secondary" disabled={busy}>
              <Trans>Cancel</Trans>
            </Button>
          }
        />
        <Button
          disabled={busy}
          onClick={() => {
            if (mode === 'export') {
              void handleExport();
            } else {
              void handleImport();
            }
          }}
        >
          {mode === 'export' ? <Trans>Export</Trans> : <Trans>Import</Trans>}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
