import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/theme-provider';
import { isDarkTheme } from '@/utils';
import { MoonIcon, SunIcon } from 'lucide-react';

export default function ToggleColorMode() {
  const theme = useTheme();

  return (
    <Button
      onClick={() => {
        const mode = theme.theme == 'dark' ? 'light' : 'dark';
        theme.setTheme(mode);
      }}
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
