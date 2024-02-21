import { Tooltip, TooltipProps, styled, tooltipClasses } from '@mui/material';

export const HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip
    enterDelay={1500}
    enterNextDelay={1500}
    {...props}
    classes={{ popper: className }}
  />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    fontSize: theme.typography.pxToRem(12),
    border: '1px solid #dadde9',
  },
}));
