import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    modal: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    container: {
        flex: 1,
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background,
    },
}))
