import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            paddingVertical: theme.spacing.xl,
        },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
        },
        labelContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        icon: {
            marginRight: theme.spacing.sm,
        },
        label: {
            color: theme.colors.textMain,
        },
        sectionTitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
    })
}
