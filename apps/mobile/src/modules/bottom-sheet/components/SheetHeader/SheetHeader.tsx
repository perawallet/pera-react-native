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

import type { ReactNode } from 'react'
import { PWIcon, PWText, PWToolbar } from '@components/core'
import { useBottomSheetResult } from '../../hooks/useBottomSheetResult'
import { useBottomSheetPanDownEnabled } from '../../hooks/useBottomSheetPanDownEnabled'
import { useBottomSheetSize } from '../../hooks/useBottomSheetSize'

import type { StyleProp, ViewStyle } from 'react-native'

import { useStyles } from './styles'

export type SheetHeaderProps = {
    title: ReactNode
    /** Optional element shown in the toolbar's right slot. */
    rightAction?: ReactNode
    /** Override the default close behaviour (which calls `dismiss()`). */
    onClose?: () => void
    paddingStyle?: 'normal' | 'dense' | 'none'
    /** Extra style forwarded to the underlying toolbar container. */
    style?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * Standard header for managed bottom-sheet content. Wires the left close
 * icon to the host sheet's `dismiss()` so callers only need to supply a
 * title (and, optionally, a right-slot action). Designed for use inside
 * a sheet rendered by `BottomSheetManager` — must be mounted under a
 * `BottomSheetIdContext`.
 *
 * The close (X) is dropped only when the host sheet is *not* full-screen and
 * enables pan-down-to-close, since the drag handle then provides dismissal.
 * Full-screen sheets (`full` / `lg` — the 96–100% snap points) keep the X
 * because the drag handle is far away, and sheets without pan-down keep it so
 * they stay dismissable.
 */
export const SheetHeader = ({
    title,
    rightAction,
    onClose,
    paddingStyle = 'dense',
    style,
    testID,
}: SheetHeaderProps) => {
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult()
    const isPanDownEnabled = useBottomSheetPanDownEnabled()
    const size = useBottomSheetSize()
    const handleClose = onClose ?? dismiss

    // Full-screen sheets keep the X (the drag handle is too far to reach);
    // smaller pan-down sheets drop it since swiping down dismisses them.
    const isFullScreen = size === 'full' || size === 'lg'
    const showClose = isFullScreen || !isPanDownEnabled

    return (
        <PWToolbar
            left={
                showClose ? (
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={handleClose}
                        testID={testID ? `${testID}-close` : undefined}
                    />
                ) : undefined
            }
            center={
                typeof title === 'string' ? (
                    <PWText
                        variant='h4'
                        truncate
                        style={styles.title}
                        testID={testID ? `${testID}-title` : undefined}
                    >
                        {title}
                    </PWText>
                ) : (
                    title
                )
            }
            right={rightAction}
            paddingStyle={paddingStyle}
            style={style}
            testID={testID}
        />
    )
}
