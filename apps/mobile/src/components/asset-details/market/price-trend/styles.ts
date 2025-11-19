import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
        },
        percentageContainer: {
            flexDirection: 'row',
            gap: theme.spacing.xs,
            alignItems: 'center',
        },
        itemUp: {
            color: theme.colors.buttonSquareText,
        },
        itemDown: {
            color: theme.colors.error,
        },
        trendIconUp: {
            backgroundColor: theme.colors.buttonSquareBg,
            borderRadius: theme.spacing.xl,
        },
        trendIconDown: {},
    })
}
