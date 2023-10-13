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
      horizontal: "right",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 0,
    // marginTop: theme.spacing(1),
    minWidth: 120,
    backgroundColor: "#2b2d30",
    fontSize: 10,
    color: !isDarkTheme(theme) ? "rgb(55, 65, 81)" : theme.palette.grey[300],
    border: "1px solid #43454a",
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1)  10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
    "& .MuiMenu-list": {
      padding: "2px 0",
    },
    "& .MuiMenuItem-root": {
      "&:active": {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity
        ),
      },
    },
    "& *": {
      fontSize: 1,
    },
  },
}));

export default function Dropdown() {
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
        1 rows
      </Button>
      <StyledMenu
        MenuListProps={{
          "aria-labelledby": "demo-customized-button",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          "&+.MuiDivider-root": {
            marginTop: 4,
            marginBottom: 4,
          },
        }}
      >
        <MenuItem>Count Rows</MenuItem>
        <Divider
          sx={{
            marginBlockEnd: 4,
            marginBlockStart: 4,
          }}
        />
        {[10, 100, 500, 1000].map((item) => (
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
