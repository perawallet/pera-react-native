import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        alignItems: 'center',
    },
    icon: {
        marginVertical: theme.spacing.md,
    },
    message: {
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
}))
