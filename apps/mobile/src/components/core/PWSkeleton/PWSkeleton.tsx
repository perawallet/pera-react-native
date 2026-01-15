import { Skeleton as RNESkeleton } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, ViewStyle } from 'react-native'

export type PWSkeletonProps = {
    animation?: 'none' | 'pulse' | 'wave'
    height?: number
    width?: number
    style?: StyleProp<ViewStyle>
    circle?: boolean
}

export const PWSkeleton = ({
    animation = 'pulse',
    height,
    width,
    style,
    circle,
}: PWSkeletonProps) => {
    const styles = useStyles()

    return (
        <RNESkeleton
            style={[styles.skeleton, style]}
            animation={animation}
            height={height}
            width={width}
            circle={circle}
        />
    )
}
