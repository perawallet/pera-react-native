import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
    flexShrink: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    gap: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    zIndex: 2,
  },
  headerText: {
    color: theme.colors.textGray,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemScrollContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  itemContainer: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
}));
