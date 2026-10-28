import { makeStyles } from '@rneui/themed'

const ALPHA = 0.4
const ACCENT = '#28A79B'
export const FOREGROUND_COLOR = 'black'
const SWATCHES = { surfaceColor: 'white', shades: ['#FFF', 'rgb(0, 0, 0)'] }

export const useStyles = makeStyles((theme, isActive: boolean) => ({
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        borderColor: '#ABCDEF80',
    },
    label: {
        color: isActive ? 'white' : theme.colors.textMain,
        shadowColor: `rgba(0, 0, 0, ${ALPHA})`,
    },
    icon: {
        tintColor: 'hsl(180, 50%, 40%)',
        shadowOffset: { width: 0, height: 2 },
    },
}))

const TEXT_COLOR = 'white' as const
const EDGE_COLOR = 'black' satisfies string
const RIM_COLOR = 'white'
const GLOW_COLOR = ALPHA > 0 ? 'white' : 'black'
const TEMPLATE_HEX = `#ff00aa`

export {
    ACCENT,
    EDGE_COLOR,
    GLOW_COLOR,
    RIM_COLOR,
    SWATCHES,
    TEMPLATE_HEX,
    TEXT_COLOR,
}
