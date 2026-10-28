import { makeStyles } from '@rneui/themed'
import { moderateScale } from '@/theme/scale'

const KEY_SIZE = 72
export const THUMB_SIZE = 64
const TAG_FONT_SIZE = 13
const ROW_LINE_HEIGHT = 20
const CAPTION_FONT_SIZE = 11

export const rowHeight = moderateScale(ROW_LINE_HEIGHT)
export const caption = { fontSize: CAPTION_FONT_SIZE }

export const useStyles = makeStyles(theme => {
    const tag = { fontSize: TAG_FONT_SIZE }
    return {
        key: { width: KEY_SIZE, height: KEY_SIZE },
        thumb: { width: THUMB_SIZE },
        tag,
        inset: { paddingBottom: theme.spacing.xl + 20 },
        half: { borderRadius: theme.spacing.xl / 2 },
        tall: { height: theme.spacing.xxl * 4 },
        sum: { marginTop: theme.spacing['3xl'] + theme.spacing.lg },
        nested: { gap: (theme.spacing.xl + 2 * theme.spacing.sm) / 2 },
        chain: {
            top: theme.spacing.lg + theme.spacing['3xl'] + theme.spacing.lg,
        },
        border: { borderWidth: theme.borders.sm * 2 },
        commented: {
            marginLeft:
                theme.spacing.lg + // row padding
                theme.spacing['3xl'],
        },
    }
})
