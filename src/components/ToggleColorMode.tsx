import { Tooltip } from '@/components/custom/tooltip';
import { Button } from '@/components/ui/button.tsx';
import { ColorModeContext } from '@/theme';
import { isDarkTheme } from '@/utils';
import { useTheme } from '@mui/material';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useContext } from 'react';

export default function ToggleColorMode() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  return (
    <Tooltip
      title={`${theme.palette.mode} mode`}
      delayDuration={800}
      skipDelayDuration={500}
    >
      <Button
        onClick={colorMode.toggleColorMode}
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg"
      >
        {isDarkTheme(theme) ? (
          <MoonIcon className="size-4" />
        ) : (
          <SunIcon className="size-4" />
        )}
      </Button>
    </Tooltip>
  );
}
