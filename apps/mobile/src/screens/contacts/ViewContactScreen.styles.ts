import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    label: {
      fontSize: 13,
      color:
        theme.mode === 'dark'
          ? theme.colors.textGrayLighter
          : theme.colors.textGray,
      marginBottom: theme.spacing.xs,
    },
    avatar: {
      alignItems: 'center',
      marginVertical: theme.spacing.xl,
    },
    value: {},
    container: {
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    addressValueContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
    },
  };
});
