import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.md,
      paddingLeft: theme.spacing.xs,
      gap: theme.spacing.sm,
      borderRadius: theme.spacing.xl,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.helperGray200,
    },
    text: {
      color: theme.colors.textGray
    },
  };
});
