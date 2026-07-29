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

  const templ = "YYYY-MM-DD HH:mm:ss";
  if (
    DataType.isDate(dataType) &&
    options.type?.toLowerCase()?.includes("datetime")
  ) {
    return dayjs(value as string | number | Date).format(templ);
  }
  if (DataType.isDate(dataType)) {
    return dayjs(value as string | number | Date).format("YYYY-MM-DD");
  }
  if (DataType.isTimestamp(dataType)) {
    if (!dataType.timezone) {
      return dayjs(value as string | number | Date).utc().format(templ);
    }
    return dayjs(value as string | number | Date).format(templ);
  }

  if (options.beautify && DataType.isFloat(dataType) && options.precision) {
    try {
      return (value as number)?.toFixed(options.precision);
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
