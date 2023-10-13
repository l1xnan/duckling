import { Theme } from "@mui/material";

export const isDarkTheme = (theme: Theme) =>
  theme.palette.mode === "dark" ? "#2b2d30" : "#f7f8fa";
