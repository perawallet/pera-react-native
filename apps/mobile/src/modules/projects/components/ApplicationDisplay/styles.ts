import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    caption: {
        color: theme.colors.textGray,
        lineHeight: theme.spacing.md,
    },
}))
