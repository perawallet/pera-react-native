import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      paddingTop: insets.top + theme.spacing.xl,
      paddingHorizontal: 0,
      flex: 1,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xl,
    },
    titleContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      alignItems: 'center',
    },
    accountSelection: {},
    titleText: {},
    titleIcon: {
      color: theme.colors.textMain,
      width: 24,
      height: 24,
    },
  };
});
