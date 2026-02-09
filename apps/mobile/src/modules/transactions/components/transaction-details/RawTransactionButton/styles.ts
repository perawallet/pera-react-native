import { makeStyles } from '@rneui/themed'
import { getFontFamily } from '@theme/theme'

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        padding: theme.spacing.md,
    },
    rawTransactionText: {
        fontFamily: getFontFamily(true, 400),
    },
}))
