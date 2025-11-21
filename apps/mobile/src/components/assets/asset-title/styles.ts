import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs
    },
    name: {
        color: theme.colors.textMain,
        marginHorizontal: theme.spacing.sm,
    },
}))
