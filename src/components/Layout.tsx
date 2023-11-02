import { Box, BoxProps, styled } from "@mui/material";
import { borderTheme } from "@/utils";

export const Content = styled(Box)<BoxProps>(({}) => ({
  flexGrow: 1,
  height: "100vh",
  maxHeight: "100vh",
  width: "calc(100vw - 300px)",
  overflow: "hidden",
}));

export const Sidebar = styled(Box)<BoxProps>(({ theme }) => ({
  flexShrink: 0,
  width: 320,
  minHeight: "100vh",
  height: "100vh",
  overflow: "auto",
  borderRight: borderTheme(theme),
}));
export const Layout = styled(Box)<BoxProps>(({ theme }) => ({
  display: "flex",
  maxHeight: "100vh",
  height: "100%",
  pr: 0,
  p: 0,
  m: 0,
}));
