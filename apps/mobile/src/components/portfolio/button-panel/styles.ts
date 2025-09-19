import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    gap: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  blackButton: {
    backgroundColor: theme.colors.buttonHelperBg,
  },
}));
