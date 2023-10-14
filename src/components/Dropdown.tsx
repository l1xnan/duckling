import * as React from "react";
import { styled, alpha } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { isDarkTheme } from "../utils";

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "left",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "left",
    }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 0,
    backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#ffffff",
    color: !isDarkTheme(theme) ? "rgb(55, 65, 81)" : theme.palette.grey[300],
    border: isDarkTheme(theme) ? "1px solid #43454a" : "1px solid #b9bdc9",
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1)  10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
    "& .MuiMenu-list": {},
    "& .MuiMenuItem-root": {
      padding: "4px 8px",
      "&:active": {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity
        ),
      },
    },
  },
}));

export interface PageSizeProps {
  rowCount: number;
}

export default function Dropdown({ rowCount }: PageSizeProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div>
      <Button
        aria-controls={open ? "demo-customized-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        variant="text"
        disableElevation
        onClick={handleClick}
        endIcon={<KeyboardArrowDownIcon />}
      >
        {rowCount} rows
      </Button>
      <StyledMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          "&+.MuiDivider-root": {
            // marginTop: 4,
            // marginBottom: 4,
          },
        }}
      >
        <MenuItem sx={{ fontWeight: 600 }} disabled>
          Page Size
        </MenuItem>
        {[10, 100, 500, 1000, "Custom..."].map((item) => (
          <MenuItem onClick={handleClose} disableRipple>
            {item}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem>Change Default: 500</MenuItem>
      </StyledMenu>
    </div>
  );
}
