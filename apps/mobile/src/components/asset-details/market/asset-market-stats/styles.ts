import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            marginBottom: theme.spacing.xl,
        },
        statsContainer: {
            flexDirection: 'row',
        },
        label: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.xs,
        },
        value: {
            color: theme.colors.textMain,
        },
        itemContainer: {
            width: '50%',
            gap: theme.spacing.sm,
        },
        labelContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        sectionTitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
    })
}
