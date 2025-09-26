import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme) => {
  return {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    webview: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      marginTop: theme.spacing.xl * 2
    }
  };
});
