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

export { ACCENT, SWATCHES }
