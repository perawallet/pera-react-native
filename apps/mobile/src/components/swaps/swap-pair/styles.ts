import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
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
  itemIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  fromIcon: {
    position: 'absolute',
    left: -5,
    top: 7,
    borderColor: theme.colors.background,
    borderWidth: 2,
    width: theme.spacing.xl,
    height: theme.spacing.xl,
  },
  toIcon: {
    position: 'relative',
    borderWidth: 2,
    borderColor: theme.colors.background,
    borderRadius: theme.spacing.xl / 2,
    left: 6,
    bottom: -6,
    zIndex: 2,
    width: theme.spacing.xl,
    height: theme.spacing.xl,
  },
}));
