import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      flex: 1,
    },
    testnetBar: {
      backgroundColor: theme.colors.testnetBackground,
      height: insets.top + theme.spacing.sm,
      zIndex: 1,
    },
    mainnetBar: {
      backgroundColor: theme.colors.background,
      height: insets.top + theme.spacing.sm,
      zIndex: 1,
    },
  };
});
