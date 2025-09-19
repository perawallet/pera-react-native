import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {},
  titleBar: {
    gap: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.xl * 1.5,
  },
  titleBarButtonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  sortButtonTitle: {
    color: theme.colors.helperPositive,
  },
  addButton: {
    color: theme.colors.buttonSquareText,
    backgroundColor: theme.colors.buttonSquareBg,
    borderRadius: theme.spacing.sm,
    width: 40,
    height: 40,
  },
}));
