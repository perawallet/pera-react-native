import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.md,
    },
    blackButton: {
        backgroundColor: theme.colors.buttonHelperBg,
    },
}))
