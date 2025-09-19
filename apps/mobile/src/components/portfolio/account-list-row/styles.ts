import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  nameContainer: {
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  balanceContainer: {
    flexDirection: 'column',
    gap: theme.spacing.xs,
    alignItems: 'flex-end',
  },
}));
