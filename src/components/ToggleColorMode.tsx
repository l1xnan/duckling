import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/theme-provider';
import { ColorModeContext } from '@/theme';
import { isDarkTheme } from '@/utils';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useContext } from 'react';

export default function ToggleColorMode() {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  return (
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
  );
}
