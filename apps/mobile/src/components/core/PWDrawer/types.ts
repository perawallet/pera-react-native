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

import { type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { type SharedValue } from 'react-native-reanimated'

/**
 * `back` leaves the panel stationary underneath and slides the content off it,
 * so the panel reads as physically below. `front` slides the panel over the
 * content instead.
 */
export type PWDrawerVariant = 'back' | 'front'

export type PWDrawerProps = {
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
    renderContent: () => ReactNode
    variant?: PWDrawerVariant
    /**
     * 0-1 open progress, when the caller wants to hold it. Supplying it does not
     * by itself hand over the gesture; see `hasOwnOpenGesture`.
     */
    progress?: SharedValue<number>
    /**
     * Set false when something else on the screen owns the opening drag — a
     * pager sharing the same horizontal axis. Drops the closed-state edge strip
     * so the two don't compete, and keeps the dismiss surfaces.
     */
    hasOwnOpenGesture?: boolean
    isSwipeEnabled?: boolean
    /** Width of the closed-state grab strip, in px. */
    edgeWidth?: number
    /** Panel width as a fraction of the window width (0-1). */
    widthRatio?: number
    /** Casts a shadow along the content's leading edge as the panel is revealed. */
    hasEdgeShadow?: boolean
    /** Grows and fades the panel's contents into place as it opens. */
    hasContentGrowIn?: boolean
    contentStyle?: StyleProp<ViewStyle>
    children: ReactNode
}
