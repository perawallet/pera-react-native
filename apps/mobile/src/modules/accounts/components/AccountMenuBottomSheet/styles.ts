import { Dimensions } from 'react-native'
import { makeStyles } from '@rneui/themed'

const { height } = Dimensions.get('window')

export const useStyles = makeStyles(theme => ({
    container: {
        height: height * 0.9,
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: theme.spacing.md,
        borderTopRightRadius: theme.spacing.md,
        overflow: 'hidden',
    },
}))
