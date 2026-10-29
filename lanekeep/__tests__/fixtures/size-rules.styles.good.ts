import { makeStyles } from '@rneui/themed'
import { manifest } from './manifest'

const PAGE_SIZE = 50
const LOGO_SIZE = manifest.width
const BASE_WIDTH = 375
const UNUSED_FONT_SIZE = 12
const INDENT = 16

export const pageCount = (total: number) => Math.ceil(total / PAGE_SIZE)

export const scale = (width: number) => width / BASE_WIDTH + 1

export const dot = () => {
    const DOT_SIZE = 6
    return DOT_SIZE
}

export const useStyles = (insets: { top: number }, bottomInset: number) =>
    makeStyles(theme => ({
        header: { paddingTop: insets.top + theme.spacing.sm },
        footer: { paddingBottom: theme.spacing.xl + bottomInset },
        pull: { marginTop: -theme.spacing.xs },
        avatar: { borderRadius: theme.borderRadius.full, width: LOGO_SIZE },
        text: { marginLeft: INDENT + theme.spacing.xl },
    }))
