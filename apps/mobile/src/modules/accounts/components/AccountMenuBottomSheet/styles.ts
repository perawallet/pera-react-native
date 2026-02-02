import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
  container: {
    height: '85%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.spacing.md,
    borderTopRightRadius: theme.spacing.md,
    overflow: 'hidden',
  },
}))
