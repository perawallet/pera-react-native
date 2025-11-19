import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center'
  }
}));
