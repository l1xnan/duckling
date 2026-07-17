import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ExportFormat, ExportOptions, exportCsv } from '@/api';
import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { pushNotification } from '@/stores/notification';

const EXPORT_COMPLETED = msg`Export completed`;

const FORMAT_ITEMS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'tsv', label: 'TSV' },
  { value: 'json', label: 'JSON' },
  { value: 'parquet', label: 'Parquet' },
  { value: 'xlsx', label: 'XLSX' },
];

const COMPRESSION_CODECS = [
  { value: 'zstd', label: 'ZSTD' },
  { value: 'snappy', label: 'Snappy' },
  { value: 'gzip', label: 'GZIP' },
  { value: 'brotli', label: 'Brotli' },
  { value: 'lz4', label: 'LZ4' },
  { value: 'uncompressed', label: null },
] as const;

const LEVEL_SUPPORTED = new Set(['zstd', 'gzip', 'brotli']);

function stripExtension(name: string) {
  return name.replace(/\.[^./\\]+$/, '');
}

function ensureExtension(path: string, format: ExportFormat) {
  const normalized = path.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  if (lower.endsWith(`.${format}`)) {
    return path;
  }
  return `${stripExtension(path)}.${format}`;
}

export type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dbId: string;
  sql?: string;
  defaultName?: string;
};

export function ExportDialog({
  open,
  onOpenChange,
  dbId,
  sql,
  defaultName,
}: ExportDialogProps) {
  const { t } = useLingui();
  const compressionItems = useMemo(
    () =>
      COMPRESSION_CODECS.map((item) => ({
        value: item.value,
        label: item.label ?? t`Uncompressed`,
      })),
    [t],
  );
  const baseName = useMemo(
    () => stripExtension(defaultName || `export-${Date.now()}`),
    [defaultName],
  );

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filePath, setFilePath] = useState('');
  const [header, setHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [quote, setQuote] = useState('"');
  const [compression, setCompression] = useState('zstd');
  const [compressionLevel, setCompressionLevel] = useState(3);
  const [jsonArray, setJsonArray] = useState(true);
  const [loading, setLoading] = useState(false);

  const suggestedName = `${baseName}.${format}`;

  const handleBrowse = async () => {
    const file = await dialog.save({
      title: t`Export`,
      defaultPath: filePath || suggestedName,
      filters: [
        {
          name: FORMAT_ITEMS.find((item) => item.value === format)?.label ?? format,
          extensions: [format],
        },
        { name: t`All Files`, extensions: ['*'] },
      ],
    });
    if (file) {
      setFilePath(ensureExtension(file, format));
    }
  };

  const buildOptions = (): ExportOptions => {
    if (format === 'csv') {
      return { header, delimiter, quote };
    }
    if (format === 'tsv') {
      return { header, delimiter: '\t', quote };
    }
    if (format === 'json') {
      return { json_array: jsonArray };
    }
    if (format === 'parquet') {
      return {
        compression,
        compression_level: LEVEL_SUPPORTED.has(compression)
          ? compressionLevel
          : undefined,
      };
    }
    return {};
  };

  const handleExport = async () => {
    if (!sql) {
      toast.error(t`No SQL to export`);
      return;
    }
    const target = ensureExtension(filePath || suggestedName, format);
    if (!filePath) {
      const picked = await dialog.save({
        title: t`Export`,
        defaultPath: target,
        filters: [
          {
            name: FORMAT_ITEMS.find((item) => item.value === format)?.label ?? format,
            extensions: [format],
          },
        ],
      });
      if (!picked) {
        return;
      }
      setFilePath(ensureExtension(picked, format));
      await runExport(ensureExtension(picked, format));
      return;
    }
    await runExport(target);
  };

  const runExport = async (file: string) => {
    setLoading(true);
    try {
      await exportCsv({
        file,
        dbId,
        sql: sql!,
        format,
        options: buildOptions(),
      });
      toast.success(t(EXPORT_COMPLETED));
      pushNotification({
        type: 'success',
        title: EXPORT_COMPLETED,
        description: file,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Export data</Trans>}
      className="sm:max-w-lg"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label>
            <Trans>Format</Trans>
          </Label>
          <Select
            value={format}
            onValueChange={(value) => {
              if (!value) {
                return;
              }
              const next = value as ExportFormat;
              setFormat(next);
              if (filePath) {
                setFilePath(ensureExtension(filePath, next));
              }
            }}
            items={FORMAT_ITEMS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FORMAT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value} label={item.label}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            <Trans>File path</Trans>
          </Label>
          <div className="flex gap-2">
            <Input
              value={filePath}
              placeholder={suggestedName}
              onChange={(e) => setFilePath(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => void handleBrowse()}>
              <Trans>Browse</Trans>
            </Button>
          </div>
        </div>

        {(format === 'csv' || format === 'tsv') && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="text-sm font-medium">
              <Trans>CSV / TSV options</Trans>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="export-header"
                checked={header}
                onCheckedChange={(value) => setHeader(!!value)}
              />
              <Label htmlFor="export-header">
                <Trans>Include header row</Trans>
              </Label>
            </div>
            {format === 'csv' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-delimiter">
                    <Trans>Delimiter</Trans>
                  </Label>
                  <Input
                    id="export-delimiter"
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    placeholder=","
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="export-quote">
                    <Trans>Quote</Trans>
                  </Label>
                  <Input
                    id="export-quote"
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder='"'
                    maxLength={1}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                <Trans>TSV uses tab as delimiter.</Trans>
              </p>
            )}
          </div>
        )}

        {format === 'json' && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="text-sm font-medium">
              <Trans>JSON options</Trans>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="export-json-array"
                checked={jsonArray}
                onCheckedChange={(value) => setJsonArray(!!value)}
              />
              <Label htmlFor="export-json-array">
                <Trans>Write as JSON array</Trans>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              <Trans>Uncheck to export NDJSON (one object per line).</Trans>
            </p>
          </div>
        )}

        {format === 'parquet' && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="text-sm font-medium">
              <Trans>Parquet options</Trans>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                <Trans>Compression</Trans>
              </Label>
              <Select
                value={compression}
                onValueChange={(value) => {
                  if (value) {
                    setCompression(value);
                  }
                }}
                items={compressionItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {compressionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value} label={item.label}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {LEVEL_SUPPORTED.has(compression) ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-level">
                  <Trans>Compression level</Trans>
                  {compression === 'zstd'
                    ? ' (1–22)'
                    : compression === 'gzip'
                      ? ' (0–9)'
                      : ' (0–11)'}
                </Label>
                <Input
                  id="export-level"
                  type="number"
                  value={compressionLevel}
                  min={compression === 'zstd' ? 1 : 0}
                  max={compression === 'zstd' ? 22 : compression === 'gzip' ? 9 : 11}
                  onChange={(e) => setCompressionLevel(Number(e.target.value) || 0)}
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="button"
            disabled={loading || !sql}
            className={cn(loading && 'opacity-80')}
            onClick={() => {
              void handleExport();
            }}
          >
            {loading ? <Trans>Exporting…</Trans> : <Trans>Export</Trans>}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
