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
