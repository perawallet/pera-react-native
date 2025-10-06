import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    selectedButtonContainer: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderWidth: 0,
      borderRadius: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
    unselectedButtonContainer: {
      backgroundColor: theme.colors.background,
      borderWidth: 0,
      borderRadius: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
    },
  };
});
