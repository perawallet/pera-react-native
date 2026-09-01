import { makeStyles } from '@rneui/themed'
import { getTypography } from '@/theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        padding: theme.spacing.md,
        marginTop: 0,
        shadowOffset: { width: 0, height: 2 },
    },
    title: {
        ...getTypography(theme, 'h2'),
        color: theme.colors.primary,
    },
}))
