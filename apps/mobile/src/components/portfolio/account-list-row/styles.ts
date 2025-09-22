import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flex: 1,
    borderBottomColor: theme.colors.layerGrayLighter,
    borderBottomWidth: 1,
    paddingVertical: theme.spacing.lg,
  },
  nameContainer: {
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'center',
  },
  balanceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  secondaryText: {
    color: theme.colors.textGrayLighter,
  },
}));
