import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    impactContainer: {
      width: '100%',
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    impactHeading: {
      color: theme.colors.textGray,
    },
    itemContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'center'
    },
    amounts: {
      gap: theme.spacing.xs
    },
    secondaryAmount: {
      color: theme.colors.textGray
    }
  };
});
