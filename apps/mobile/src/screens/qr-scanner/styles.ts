import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme) => {
  return {
    container: {
      flex: 1,
      padding: 0,
      margin: 0
    },
    backButton: {
      paddingTop: theme.spacing.xl,
      zIndex: 2,
      marginHorizontal: theme.spacing.lg
    },
    icon: {
      color: theme.colors.textWhite,
      zIndex: 2
    }
  };
});
