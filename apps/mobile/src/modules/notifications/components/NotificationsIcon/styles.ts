import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
  badge: {
    position: 'absolute',
    top: -theme.spacing.sm,
    right: -theme.spacing.sm,
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.spacing.lg,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
