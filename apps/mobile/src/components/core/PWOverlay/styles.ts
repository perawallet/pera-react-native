import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
  overlay: {
    backgroundColor: theme.colors.layerGrayLightest,
    padding: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
  },
}))
