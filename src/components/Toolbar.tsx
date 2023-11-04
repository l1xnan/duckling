import { borderTheme, isDarkTheme } from "@/utils";
import { Stack, StackProps, styled } from "@mui/material";


export const ToolbarContainer = styled((props: StackProps) => (
  <Stack
    direction="row"
    alignItems="center"
    justifyContent="space-between"
    {...props}
  >
    {props.children}
  </Stack>
))(({ theme }) => ({
  backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
  height: 32,
  alignItems: "center",
  borderBottom: borderTheme(theme),
  "& input, & input:focus-visible": {
    border: "none",
    height: "100%",
    padding: 0,
    outlineWidth: 0,
  },
}));
