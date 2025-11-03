import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    gap: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  activity: {
    color: theme.colors.primary,
  },
}));
