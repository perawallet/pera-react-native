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

import { useCallback } from 'react'
import type { GestureResponderEvent } from 'react-native'
import {
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
} from '@components/core'
import { useClipboard } from '@hooks/useClipboard'

export type CopyableTextProps = {
    copyValue: string
    children: React.ReactNode
} & Omit<PWTouchableOpacityProps, 'children'>

export const CopyableText = ({
    copyValue,
    children,
    onLongPress,
    activeOpacity = 1,
    accessibilityHint = 'Long press to copy',
    ...rest
}: CopyableTextProps) => {
    const { copyToClipboard } = useClipboard()

    const handleLongPress = useCallback(
        (event: GestureResponderEvent) => {
            void copyToClipboard(copyValue)
            onLongPress?.(event)
        },
        [copyValue, copyToClipboard, onLongPress],
    )

    return (
        <PWTouchableOpacity
            {...rest}
            activeOpacity={activeOpacity}
            onLongPress={handleLongPress}
            accessibilityHint={accessibilityHint}
        >
            {children}
        </PWTouchableOpacity>
    )
}
