import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderRadius: theme.spacing.lg,
      backgroundColor: theme.colors.layerGrayLightest,
    },
    text: {},
  };
});
