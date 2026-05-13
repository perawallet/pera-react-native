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

export type SheetHeaderProps = {
    title: ReactNode
    /** Optional element shown in the toolbar's right slot. */
    rightAction?: ReactNode
    /** Override the default close behaviour (which calls `dismiss()`). */
    onClose?: () => void
    paddingStyle?: 'normal' | 'dense' | 'none'
    testID?: string
}

/**
 * Standard header for managed bottom-sheet content. Wires the left close
 * icon to the host sheet's `dismiss()` so callers only need to supply a
 * title (and, optionally, a right-slot action). Designed for use inside
 * a sheet rendered by `BottomSheetManager` — must be mounted under a
 * `BottomSheetIdContext`.
 */
export const SheetHeader = ({
    title,
    rightAction,
    onClose,
    paddingStyle = 'dense',
    testID,
}: SheetHeaderProps) => {
    const { dismiss } = useBottomSheetResult()
    const handleClose = onClose ?? dismiss

    return (
        <PWToolbar
            left={
                <PWIcon
                    name='cross'
                    variant='secondary'
                    onPress={handleClose}
                    testID={testID ? `${testID}-close` : undefined}
                />
            }
            center={
                typeof title === 'string' ? (
                    <PWText
                        variant='h4'
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
            testID={testID}
        />
    )
}
