import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        contentContainer: {
            paddingTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
        },
        header: {
            paddingVertical: theme.spacing.md,
        },
        assetRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.sm,
        },
        headerIcons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },

        chartContainer: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.xl,
        },
        discoverButton: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.sm,
            padding: theme.spacing.md,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.xl,
        },
        discoverText: {
            color: theme.colors.textGray,
        },
        discoverLink: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        discoverLinkText: {
            marginRight: theme.spacing.xs,
        },
        sectionTitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            textTransform: 'uppercase',
        },
        tagsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xl,
        },
        tag: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
        },
        tagText: {
            fontSize: 12,
            fontWeight: '500',
            color: theme.colors.textMain,
            marginLeft: theme.spacing.xs,
        },
        loadingContainer: {
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
        },
        skeleton: {
            height: theme.spacing.xl * 6,
            width: '100%',
        },
    })
}
