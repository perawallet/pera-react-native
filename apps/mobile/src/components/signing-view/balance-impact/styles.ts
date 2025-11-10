import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
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
      alignItems: 'center',
    },
    amounts: {
      gap: theme.spacing.xs,
    },
    secondaryAmount: {
      color: theme.colors.textGray,
    },
  };
});
