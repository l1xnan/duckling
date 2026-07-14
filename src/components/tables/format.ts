import { DataType } from "apache-arrow";
import dayjs from "dayjs"; // 假设你使用了 dayjs
import utc from "dayjs/plugin/utc"; // 如果没引入utc插件记得引入
dayjs.extend(utc);

export type FieldFormatParamsType = {
  key: string;
  dataType: DataType;
  type?: string;
  beautify?: boolean;
  precision?: number;
};

// 提取出的递归处理函数
const formatArrowValue = (
  value: any,
  dataType: any,
  options: Omit<FieldFormatParamsType, "key">,
): any => {
  // 1. 处理空值
  if (value === null || value === undefined) {
    return "<null>";
  }

  // 2. 处理 List / FixedSizeList / LargeList 类型
  if (DataType.isList(dataType) || DataType.isFixedSizeList?.(dataType)) {
    // List 的 dataType.children[0] 代表里面元素的 Field 信息
    const childType = dataType.children[0].type;
    // 遍历类数组，递归格式化每个元素
    return [...value].map((item) => formatArrowValue(item, childType, options));
  }

  // 3. 处理 Struct 类型
  if (DataType.isStruct(dataType)) {
    const formattedStruct: Record<string, any> = {};
    // Struct 的 dataType.children 是一个包含各字段 (Field) 信息的数组
    dataType.children.forEach((field: any) => {
      const fieldName = field.name;
      const fieldType = field.type;
      // 递归格式化 struct 内的每个字段值
      formattedStruct[fieldName] = formatArrowValue(
        value[fieldName],
        fieldType,
        options,
      );
    });
    return formattedStruct;
  }

  // --- 下面是原有的基础类型处理逻辑 ---
  if (typeof value === "bigint") {
    return value.toString(); // 转为字符串，避免精度丢失且保证渲染安全
  }
  // 处理 Decimal
  if (DataType.isDecimal(dataType)) {
    const { scale } = dataType;
    return value
      .toString()
      .padStart(scale + 1, "0")
      .replace(new RegExp(`(.{${scale}})$`), ".$1");
  }

  // 处理 Date / Timestamp
  const templ = "YYYY-MM-DD HH:mm:ss";
  if (
    DataType.isDate(dataType) &&
    options.type?.toLowerCase()?.includes("datetime")
  ) {
    return dayjs(value).format(templ);
  } else if (DataType.isDate(dataType)) {
    return dayjs(value).format("YYYY-MM-DD");
  } else if (DataType.isTimestamp(dataType)) {
    if (!dataType.timezone) {
      return dayjs(value).utc().format(templ);
    }
    return dayjs(value).format(templ);
  }

  // 处理 Float 精度美化
  if (options.beautify && DataType.isFloat(dataType) && options.precision) {
    try {
      return (value as number)?.toFixed(options.precision);
    } catch (_error) {
      return value;
    }
  }

  // 兜底返回原值 (Int, String, Boolean 等)
  return value;
};

// 暴露给外部的主函数
export const handleFieldFormat = (
  record: any,
  params: FieldFormatParamsType,
) => {
  const { key, dataType, type, beautify, precision } = params;
  const rawValue = record[key];

  // 调用递归函数处理数据
  const formattedValue = formatArrowValue(rawValue, dataType, {
    dataType,
    type,
    beautify,
    precision,
  });

  // 【渲染适配】：如果该函数最终用于前端 Table 展示 (React/Vue 等)
  // 因为 UI 库通常无法直接渲染对象/数组，遇到嵌套结构时我们将其序列化为 JSON 字符串
  if (typeof formattedValue === "object" && formattedValue !== null) {
    return JSON.stringify(formattedValue); // 视 UI 需求，也可以用 JSON.stringify(formattedValue, null, 2)
  }

  return formattedValue;
};
