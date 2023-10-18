import { IconButton, IconButtonProps, styled } from "@mui/material";
import * as React from "react";

import SvgIcon from "@mui/material/SvgIcon";
import { TablerIconsProps } from "@tabler/icons-react";

interface TablerSvgIconProps extends TablerIconsProps {
  icon: any;
}

export const TablerSvgIcon = React.forwardRef<
  SVGSVGElement,
  TablerSvgIconProps
>(({ icon }, ref) => {
  return <SvgIcon ref={ref}>{icon}</SvgIcon>;
});

export const MuiIconButton = styled((props) => (
  <IconButton color="inherit" {...props} />
))<IconButtonProps>(({}) => ({
  "& *": {
    fontSize: 16,
    height: 16,
    width: 16,
  },
}));
