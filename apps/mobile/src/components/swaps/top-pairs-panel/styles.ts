import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    padding: theme.spacing.lg,
  },
  headerContainer: {
    gap: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginVertical: theme.spacing.sm,
  },
  itemContainer: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  itemIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  fromIcon: {
    position: 'absolute',
    left: -5,
    top: 7,
  },
  toIcon: {
    position: 'relative',
    borderWidth: 2,
    borderColor: theme.colors.background,
    borderRadius: 8,
    left: 8,
    bottom: -8,
  },
}));
