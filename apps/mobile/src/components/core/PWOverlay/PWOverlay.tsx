/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    Overlay as RNEOverlay,
    OverlayProps as RNEOverlayProps,
} from '@rneui/themed'
import { useStyles } from './styles'

/**
 * Props for the PWOverlay component.
 */
export type PWOverlayProps = {
    /** Whether the overlay is visible */
    isVisible: boolean
    /** Callback when the backdrop is pressed */
    onBackdropPress?: () => void
    /** Content to display inside the overlay */
    children: React.ReactNode
    /** Style overrides for the overlay container */
    overlayStyle?: RNEOverlayProps['overlayStyle']
    /** Style overrides for the backdrop */
    backdropStyle?: RNEOverlayProps['backdropStyle']
    /** Whether to display the overlay in full screen */
    fullScreen?: boolean
}

/**
 * A themed overlay component for displaying modal content.
 * Wraps RNE Overlay with project styling.
 *
 * @example
 * <PWOverlay isVisible={isVisible} onBackdropPress={closeModal}>
 *   <PWText>Overlay Content</PWText>
 * </PWOverlay>
 */
export const PWOverlay = ({
    isVisible,
    onBackdropPress,
    children,
    overlayStyle,
    backdropStyle,
    fullScreen,
    ...props
}: PWOverlayProps) => {
    const styles = useStyles()

    return (
        <RNEOverlay
            isVisible={isVisible}
            onBackdropPress={onBackdropPress}
            overlayStyle={[styles.overlay, overlayStyle]}
            backdropStyle={backdropStyle}
            fullScreen={fullScreen}
            {...props}
        >
            {children}
        </RNEOverlay>
    )
}
