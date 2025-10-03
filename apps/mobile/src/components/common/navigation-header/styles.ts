import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
  },
  title: {
    textAlign: 'center',
    flexGrow: 1,
  },
  backIcon: {
    width: theme.spacing.xl * 2,
    color: theme.colors.textMain,
  },
  backIconContainer: {
    paddingHorizontal: theme.spacing.sm,
    width: theme.spacing.xl * 2,
  },
}));
