import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
            borderRadius: theme.spacing.sm,
            padding: theme.spacing.xl,
            marginBottom: theme.spacing.md,
        },
        content: {
            gap: theme.spacing.md
        },
        icon: {
            marginTop: theme.spacing.xs
        },
        learnMoreContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: theme.spacing.sm,
        },
        learnMoreText: {
            fontSize: 16,
            fontWeight: '500',
            color: theme.colors.linkPrimary,
            marginLeft: theme.spacing.xs,
        },
    })
}
