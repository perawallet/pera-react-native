import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme) => ({
  webview: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    flex: 1,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  }
}));
