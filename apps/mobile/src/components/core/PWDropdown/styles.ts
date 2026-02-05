import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
  overlay: {
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 200,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.layerGrayLight,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  label: {
    color: theme.colors.textMain,
  },
  labelDestructive: {
    color: theme.colors.error,
  },
}))
