import { Overlay as RNEOverlay, OverlayProps as RNEOverlayProps } from '@rneui/themed'
import { useStyles } from './styles'

export type PWOverlayProps = {
    isVisible: boolean
    onBackdropPress?: () => void
    children: React.ReactNode
    overlayStyle?: RNEOverlayProps['overlayStyle']
    backdropStyle?: RNEOverlayProps['backdropStyle']
    fullScreen?: boolean
}

export const PWOverlay = ({
    isVisible,
    onBackdropPress,
    children,
    overlayStyle,
    backdropStyle,
    fullScreen,
}: PWOverlayProps) => {
    const styles = useStyles()

    return (
        <RNEOverlay
            isVisible={isVisible}
            onBackdropPress={onBackdropPress}
            overlayStyle={[styles.overlay, overlayStyle]}
            backdropStyle={backdropStyle}
            fullScreen={fullScreen}
        >
            {children}
        </RNEOverlay>
    )
}
