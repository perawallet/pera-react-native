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
    color: theme.colors.helperPositive,
  },
  itemScrollContainer: {
    gap: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  itemContainer: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    boxShadow: '0px 2px 4px -1px #00000014',
    borderWidth: 1,
    borderColor: theme.colors.layerGrayLighter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
}));
