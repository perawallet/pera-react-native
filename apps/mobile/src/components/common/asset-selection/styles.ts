import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderRadius: theme.spacing.lg,
      backgroundColor: theme.colors.layerGrayLightest,
      width: theme.spacing.xl * 5
    },
    text: {},
    icon: {
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: theme.spacing.xl / 2,
    }
  };
});
