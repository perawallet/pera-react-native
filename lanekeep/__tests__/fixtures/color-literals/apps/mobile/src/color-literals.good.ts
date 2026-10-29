import { makeStyles } from '@rneui/themed'

// Colour names outside a colour slot are icon variants, not colours.
const ICON_VARIANTS = { primary: 'white', destructive: 'black' }
const ANCHOR = '#section'

export const useStyles = makeStyles(theme => ({
    container: {
        backgroundColor: theme.colors.background,
        borderColor: 'transparent',
    },
    fill: {
        color: `${theme.colors.positive}4D`,
    },
}))

// Function bodies and JSX props are outside the rule's two contexts.
export const pickColor = (isActive: boolean): string =>
    isActive ? '#000000' : 'white'

export { ANCHOR, ICON_VARIANTS }
