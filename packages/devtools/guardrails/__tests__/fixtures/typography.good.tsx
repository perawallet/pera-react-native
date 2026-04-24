import { makeStyles } from '@rneui/themed'
import { getTypography } from '@/theme/typography'

export const useStyles = makeStyles(theme => ({
    label: {
        ...getTypography(theme, 'h1'),
        color: theme.colors.text,
    },
}))
