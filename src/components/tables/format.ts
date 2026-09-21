import { DataType } from "@apache-arrow/ts";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

export type FieldFormatParamsType = {
  key: string;
  dataType: DataType;
  type?: string;
  beautify?: boolean;
  precision?: number;
};

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DATE_FORMAT = "YYYY-MM-DD";

function sqlTypeDateKind(type?: string): "date" | "timestamp" | null {
  if (!type) {
    return null;
  }
  const t = type.toLowerCase();
  if (t.includes("timestamp") || t.includes("datetime")) {
    return "timestamp";
  }
  if (/\bdate\b/.test(t) || t.includes("date32") || t.includes("date64")) {
    return "date";
  }
  return null;
}

function formatDateScalar(value: unknown, withTime: boolean): string {
  const pattern = withTime ? DATE_TIME_FORMAT : DATE_FORMAT;
  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value);
    if (abs >= 1e12) {
      return withTime
        ? dayjs(value).format(pattern)
        : dayjs(value).format(DATE_FORMAT);
    }
    if (abs >= 1e9 && abs < 1e12) {
      const d = dayjs.unix(value);
      return withTime ? d.format(pattern) : d.format(DATE_FORMAT);
    }
    return dayjs.utc("1970-01-01").add(value, "day").format(pattern);
  }
  if (typeof value === "bigint") {
    return formatDateScalar(Number(value), withTime);
  }
  if (withTime) {
    return dayjs(value as string | number | Date).format(pattern);
  }
  return dayjs(value as string | number | Date).format(DATE_FORMAT);
}

function formatTimestampScalar(
  value: unknown,
  dataType: DataType,
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const abs = Math.abs(value);
    if (abs >= 1e12) {
      return !dataType.timezone
        ? dayjs(value).utc().format(DATE_TIME_FORMAT)
        : dayjs(value).format(DATE_TIME_FORMAT);
    }
    if (abs >= 1e9 && abs < 1e12) {
      const d = dayjs.unix(value);
      return !dataType.timezone
        ? d.utc().format(DATE_TIME_FORMAT)
        : d.format(DATE_TIME_FORMAT);
    }
    if (abs < 1_000_000) {
      return dayjs.utc("1970-01-01").add(value, "day").format(DATE_TIME_FORMAT);
    }
  }
  if (!dataType.timezone) {
    return dayjs(value as string | number | Date)
      .utc()
      .format(DATE_TIME_FORMAT);
  }
  return dayjs(value as string | number | Date).format(DATE_TIME_FORMAT);
}

const formatArrowValue = (
  value: unknown,
  dataType: DataType,
  options: Omit<FieldFormatParamsType, "key">,
): unknown => {
  if (value === null || value === undefined) {
    return "<null>";
  }

  if (DataType.isList(dataType) || DataType.isFixedSizeList?.(dataType)) {
    const childType = dataType.children[0].type;
    return [...(value as Iterable<unknown>)].map((item) =>
      formatArrowValue(item, childType, options),
    );
  }

  if (DataType.isStruct(dataType)) {
    const formattedStruct: Record<string, unknown> = {};
    dataType.children.forEach((field) => {
      formattedStruct[field.name] = formatArrowValue(
        (value as Record<string, unknown>)[field.name],
        field.type,
        options,
      );
    });
    return formattedStruct;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }
  if (DataType.isDecimal(dataType)) {
    const { scale } = dataType;
    return (value as { toString: () => string })
      .toString()
      .padStart(scale + 1, "0")
      .replace(new RegExp(`(.{${scale}})$`), ".$1");
  }

  if (
    DataType.isDate(dataType) &&
    options.type?.toLowerCase()?.includes("datetime")
  ) {
    return formatDateScalar(value, true);
  }
  if (DataType.isDate(dataType)) {
    return formatDateScalar(value, false);
  }
  if (DataType.isTimestamp(dataType)) {
    return formatTimestampScalar(value, dataType);
  }

  const sqlDate = sqlTypeDateKind(options.type);
  if (sqlDate === "date") {
    return formatDateScalar(value, false);
  }
  if (sqlDate === "timestamp") {
    return formatDateScalar(value, true);
  }

  const typeLower = options.type?.toLowerCase() ?? "";
  const floatLike =
    DataType.isFloat(dataType) ||
    typeLower.includes("float") ||
    typeLower.includes("double") ||
    typeLower.includes("real") ||
    (typeLower.includes("decimal") && !typeLower.includes("("));

  if (
    options.beautify &&
    options.precision != null &&
    floatLike &&
    typeof value === "number"
  ) {
    try {
      return value.toFixed(options.precision);
    } catch (_error) {
      return value;
    }
  }

  return value;
};

export function formatCellForGrid(
  rawValue: unknown,
  dataType: DataType,
  options: Omit<FieldFormatParamsType, "key">,
): string | number | boolean | null | undefined {
  const formattedValue = formatArrowValue(rawValue, dataType, options);
  if (typeof formattedValue === "object" && formattedValue !== null) {
    return JSON.stringify(formattedValue);
  }
  return formattedValue as string | number | boolean;
}

export const handleFieldFormat = (
  record: Record<string, unknown>,
  params: FieldFormatParamsType,
) => {
  const { key, dataType, type, beautify, precision } = params;
  const rawValue = record[key];
  return formatCellForGrid(rawValue, dataType, {
    dataType,
    type,
    beautify,
    precision,
  });
};
