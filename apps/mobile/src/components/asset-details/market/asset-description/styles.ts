import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            paddingVertical: theme.spacing.xl,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.divider,
        },
        title: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
    })
}
