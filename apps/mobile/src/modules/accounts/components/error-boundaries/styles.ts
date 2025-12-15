import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
    },
    message: {
        textAlign: 'center',
    },
    button: {
        minWidth: 200,
    },
}))
