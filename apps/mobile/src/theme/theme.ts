import { createTheme } from '@rneui/themed';

export const getTheme = (mode: 'light' | 'dark' = 'light') =>
  createTheme({
    lightColors: {
      // Primary/secondary brand
      primary: '#6B46FE', // ButtonPrimary/newBg (light)
      secondary: '#6B46FE', // ButtonSecondary/newText (light) - used as accent
      // Surfaces
      background: '#FFFFFF', // Defaults/bg (light)
      // Neutrals
      black: '#18181B', // Text/main (light)
      white: '#FFFFFF',
      grey0: '#FAFAFA', // Layer/grayLightest (light)
      grey1: '#F1F1F2', // Layer/grayLighter (light)
      grey2: '#E4E4E7', // Layer/grayLight (light)
      grey3: '#D4D4D8', // Layer/gray (light)
      grey4: '#A1A1AA', // Separator/grayLighter (light)
      grey5: '#71717A', // ButtonPrimary/newDisabledText
      // States
      success: '#2CB7BC', // Alert/positive
      warning: '#FFEE55', // Link/primary (dark variant) used as generic warning
      error: '#DB4645', // Alert/negative (light)
      // Misc
      divider: 'rgba(0,0,0,0.05)', // Border/default (light)
    },
    darkColors: {
      // Primary/secondary brand (dark variants)
      primary: '#AC8EFF', // ButtonPrimary/newBg (dark)
      secondary: '#AC8EFF', // ButtonSecondary/newText (dark)
      // Surfaces
      background: '#18181B', // Defaults/bg (dark)
      // Neutrals
      black: '#000000',
      white: '#F1F1F2', // Text/main (dark)
      grey0: '#27272A', // Layer/grayLightest (dark)
      grey1: '#27272A', // Layer/grayLighter (dark)
      grey2: '#3F3F46', // Layer/grayLight (dark)
      grey3: '#3F3F46', // Layer/gray (dark)
      grey4: '#71717A', // Separator/grayLighter (dark)
      grey5: '#71717A', // ButtonPrimary/newDisabledText
      // States
      success: '#2CB7BC', // Alert/positive
      warning: '#FFEE55', // Link/primary (dark)
      error: '#FF6D5F', // Alert/negative (dark)
      // Misc
      divider: 'rgba(255,255,255,0.05)', // Border/default (dark)
    },
    mode,
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  });

const theme = getTheme('light');
export default theme;
