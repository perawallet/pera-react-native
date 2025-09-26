import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    webview: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      marginTop: insets.top
    }
  };
});
