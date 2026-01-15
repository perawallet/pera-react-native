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
