import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { IconButton, useTheme } from '@mui/material';
import { useContext } from 'react';

import { Tooltip } from '@/components/custom/tooltip';
import { ColorModeContext } from '@/theme';
import { isDarkTheme } from '@/utils';

export default function ToggleColorMode() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  return (
    <Tooltip
      title={`${theme.palette.mode} mode`}
      delayDuration={800}
      skipDelayDuration={500}
    >
      <IconButton onClick={colorMode.toggleColorMode} size="small">
        {isDarkTheme(theme) ? (
          <Brightness7Icon fontSize="inherit" />
        ) : (
          <Brightness4Icon fontSize="inherit" />
        )}
      </IconButton>
    </Tooltip>
  );
}
