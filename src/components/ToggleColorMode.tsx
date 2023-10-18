import { Tooltip, useTheme } from "@mui/material";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useContext } from "react";
import { ColorModeContext } from "@/theme";
import { isDarkTheme } from "@/utils";
import { MuiIconButton } from "./MuiIconButton";

export default function ToggleColorMode() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  return (
    <Tooltip title={`${theme.palette.mode} mode`}>
      <MuiIconButton onClick={colorMode.toggleColorMode}>
        {isDarkTheme(theme) ? <Brightness7Icon fontSize="small"/> : <Brightness4Icon fontSize="small"/>}
      </MuiIconButton>
    </Tooltip>
  );
}
