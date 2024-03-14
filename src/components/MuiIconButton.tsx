import { IconButton, IconButtonProps, styled } from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { IconProps } from '@tabler/icons-react';
import * as React from 'react';
import { ReactNode } from 'react';

interface TablerIconsProps extends IconProps {
  icon: ReactNode;
}

export const TablerSvgIcon = React.forwardRef<SVGSVGElement, TablerIconsProps>(
  ({ icon }, ref) => {
    return <SvgIcon ref={ref}>{icon}</SvgIcon>;
  },
);

export const MuiIconButton = styled((props) => (
  <IconButton color="inherit" size="small" {...props} />
))<IconButtonProps>(() => ({
  '& *': {
    fontSize: 16,
    height: 16,
    width: 16,
  },
}));
