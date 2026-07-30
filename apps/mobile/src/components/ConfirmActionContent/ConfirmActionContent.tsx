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

import {
    type IconName,
    type PWButtonProps,
    type PWIconVariant,
} from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { ConfirmActionLayout } from './ConfirmActionLayout'

import type { ReactNode } from 'react'

export type ConfirmActionContentProps<TResult = boolean> = {
    icon?: IconName
    iconVariant?: PWIconVariant
    title?: string
    message?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    confirmValue?: TResult
    onConfirm?: () => void
    onCancel?: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
    confirmTestID?: string
    cancelTestID?: string
}

export const ConfirmActionContent = <TResult = boolean,>({
    icon,
    iconVariant = 'primary',
    title,
    message,
    confirmLabel,
    cancelLabel,
    confirmValue = true as TResult,
    onConfirm,
    onCancel,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    buttonPaddingStyle,
    testID,
    confirmTestID,
    cancelTestID,
}: ConfirmActionContentProps<TResult>) => {
    const { resolve, dismiss } = useBottomSheetResult<TResult>()

    // Presentation lives in ConfirmActionLayout so the same panel can render
    // outside a sheet (see its module comment). This component's only job is
    // binding the buttons to the sheet result when the caller hasn't.
    return (
        <ConfirmActionLayout
            icon={icon}
            iconVariant={iconVariant}
            title={title}
            message={message}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            onConfirm={onConfirm ?? (() => resolve(confirmValue))}
            onCancel={onCancel ?? dismiss}
            confirmVariant={confirmVariant}
            cancelVariant={cancelVariant}
            buttonPaddingStyle={buttonPaddingStyle}
            testID={testID}
            confirmTestID={confirmTestID}
            cancelTestID={cancelTestID}
        />
    )
}
