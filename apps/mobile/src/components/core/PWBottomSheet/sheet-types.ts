/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { PropsWithChildren } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type PWBottomSheetSize = 'full' | 'modal' | 'auto'

export type PWBottomSheetProps = {
    isVisible: boolean
    onBackdropPress?: () => void
    onDismiss?: () => void
    innerContainerStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
    snapPoints?: (string | number)[]
    enablePanDownToClose?: boolean
    enableContentPanningGesture?: boolean
    size?: PWBottomSheetSize
    /**
     * Wraps an `auto` sheet's content in gorhom's measured container. Set false
     * when the body must scroll within a bound or pin a footer. Fixed-height
     * sizes always fill the sheet and ignore it.
     */
    autoCreateContainer?: boolean
    testID?: string
    enableCloseOnBackdropPress?: boolean
    /**
     * Shrink a fixed-height sheet to the space above the keyboard. Defaults to
     * true. Set false when the content already insets itself for the keyboard —
     * a WebView does, and avoiding on top of that shifts the page twice.
     */
    avoidKeyboard?: boolean
    /**
     * Draws the drag handle over the content instead of above it, so content
     * such as a banner can reach the sheet's top edge. The content must leave
     * the handle's strip free of anything to tap.
     */
    handleOverlaysContent?: boolean
} & PropsWithChildren
