import { createTheme } from '@rneui/themed';

const theme = createTheme({
  lightColors: {
    primary: 'black',
    background: 'blue',
  },
  darkColors: {
    primary: '#000',
  },
  mode: 'light',
});

export default theme;
