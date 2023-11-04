import {
  Menu,
  MenuItem,
  MenuItemProps,
  MenuProps,
  styled,
} from "@mui/material";

import { isDarkTheme } from "@/utils";

export const ContextMenu = styled((props: MenuProps) => (
  <Menu
    // elevation={0}
    // anchorOrigin={{
    //   vertical: "bottom",
    //   horizontal: "left",
    // }}
    // transformOrigin={{
    //   vertical: "top",
    //   horizontal: "left",
    // }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    // borderRadius: 0,
    backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#ffffff",
    color: !isDarkTheme(theme) ? "rgb(55, 65, 81)" : theme.palette.grey[300],
    border: isDarkTheme(theme) ? "1px solid #43454a" : "1px solid #b9bdc9",
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1)  10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
  },
}));

export const ContextMenuItem = styled((props: MenuItemProps) => (
  <MenuItem dense {...props} />
))(({ theme }) => ({
  paddingLeft: "8px",
  paddingRight: "8px",
  marginLeft: "8px",
  marginRight: "8px",
  borderRadius: "4px",
  minHeight: 0,

  "&:hover": {
    backgroundColor: isDarkTheme(theme) ? "#2e436e" : "#d4e2ff",
  },
}));
