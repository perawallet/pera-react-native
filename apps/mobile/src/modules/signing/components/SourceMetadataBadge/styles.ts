import { makeStyles } from '@rneui/themed'

const ICON_SIZE = 20

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.altBackground,
        borderRadius: ICON_SIZE,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        gap: theme.spacing.sm,
        flexShrink: 1,
        marginBottom: theme.spacing.xl,
    },
    icon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
    },
    iconFallback: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    name: {
        color: theme.colors.background,
    },
    separator: {
        color: theme.colors.textGrayLighter,
    },
    url: {
        color: theme.colors.textGrayLighter,
    },
}))
