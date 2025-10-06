import { useAppStore } from '@perawallet/core';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const useIsDarkMode = () => {
  const themeMode = useAppStore(state => state.theme);
  const scheme = useColorScheme();
  const isDarkMode = useMemo(() => {
    return (
      themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark')
    );
  }, [themeMode, scheme]);

  return isDarkMode;
};
