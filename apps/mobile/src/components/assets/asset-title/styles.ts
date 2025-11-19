import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.textMain,
        marginHorizontal: theme.spacing.sm,
    },
}))
