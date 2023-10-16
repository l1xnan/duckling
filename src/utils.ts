import { Theme } from "@mui/material";

export const isDarkTheme = (theme: Theme) => theme.palette.mode === "dark";

export function getByteLength(str: string) {
  let length = 0;
  [...str].forEach((char) => {
    length += char.charCodeAt(0) > 255 ? 2 : 1;
  });
  return length;
}
