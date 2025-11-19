import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            paddingVertical: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.divider,
        },
        sectionTitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
    })
}
