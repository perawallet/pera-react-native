import { ActivityIndicator } from 'react-native'
import PWView from '../view/PWView'
import { Skeleton, useTheme } from '@rneui/themed'
import { useStyles } from './styles'

type LoadingViewProps = {
    variant: 'circle' | 'skeleton'
    size?: 'sm' | 'lg'
    count?: number
}

const LoadingView = ({ variant, size = 'sm', count = 1 }: LoadingViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    if (variant === 'circle') {
        return (
            <PWView style={styles.container}>
                <ActivityIndicator
                    size={size === 'sm' ? 'small' : 'large'}
                    color={theme.colors.primary}
                />
            </PWView>
        )
    }

    if (variant === 'skeleton') {
        return (
            <PWView style={styles.container}>
                {Array.from({ length: count }, (_, i) => (
                    <Skeleton
                        key={i}
                        style={styles.skeleton}
                        height={
                            size === 'sm'
                                ? theme.spacing.xl * 2
                                : theme.spacing.xl * 6
                        }
                    />
                ))}
            </PWView>
        )
    }
}

export default LoadingView
