import { IconButton, IconButtonProps, styled } from "@mui/material";

export const MuiIconButton = styled((props) => (
  <IconButton color="inherit" {...props} />
))<IconButtonProps>(({}) => ({
  "& *": {
    fontSize: 16,
    height: 16,
    width: 16,
  },
}));
