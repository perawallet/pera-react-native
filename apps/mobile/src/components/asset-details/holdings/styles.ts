import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => ({
  container: {
    flex: 1
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    flex: 1
  },
  header: {
    paddingVertical: theme.spacing.md
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    marginLeft: theme.spacing.md
  },
  fiatText: {
    color: theme.colors.textGray
  },
  chartContainer: {
    marginBottom: theme.spacing.lg
  }
}));
