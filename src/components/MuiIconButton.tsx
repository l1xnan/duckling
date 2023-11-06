import { IconButton, IconButtonProps, styled } from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { TablerIconsProps } from '@tabler/icons-react';
import * as React from 'react';

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
  <IconButton color="inherit" size="small" {...props} />
))<IconButtonProps>(({}) => ({
  '& *': {
    fontSize: 16,
    height: 16,
    width: 16,
  },
}));
