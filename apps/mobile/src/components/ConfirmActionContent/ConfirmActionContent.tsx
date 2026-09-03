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

import type { IconName, PWButtonProps, PWIconVariant } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { ConfirmActionLayout } from './ConfirmActionLayout'

import type { ReactNode } from 'react'

export type ConfirmActionContentProps<TResult = boolean> = {
    icon?: IconName
    iconVariant?: PWIconVariant
    /** Remote image (e.g. a dApp logo) shown in place of `icon` when set. */
    iconUrl?: string
    title?: string
    message?: ReactNode
    isMessageCentered?: boolean
    confirmLabel?: string
    cancelLabel?: string
    tertiaryLabel?: string
    confirmValue?: TResult
    tertiaryValue?: TResult
    onConfirm?: () => void
    onCancel?: () => void
    onTertiary?: () => void
    confirmVariant?: PWButtonProps['variant']
    cancelVariant?: PWButtonProps['variant']
    tertiaryVariant?: PWButtonProps['variant']
    buttonPaddingStyle?: PWButtonProps['paddingStyle']
    testID?: string
    confirmTestID?: string
    cancelTestID?: string
}

export const ConfirmActionContent = <TResult = boolean,>({
    icon,
    iconVariant = 'primary',
    iconUrl,
    title,
    message,
    isMessageCentered,
    confirmLabel,
    cancelLabel,
    tertiaryLabel,
    confirmValue = true as TResult,
    tertiaryValue,
    onConfirm,
    onCancel,
    onTertiary,
    confirmVariant = 'primary',
    cancelVariant = 'secondary',
    tertiaryVariant = 'errorLink',
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
            iconUrl={iconUrl}
            title={title}
            message={message}
            isMessageCentered={isMessageCentered}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            tertiaryLabel={tertiaryLabel}
            onConfirm={onConfirm ?? (() => resolve(confirmValue))}
            onCancel={onCancel ?? dismiss}
            onTertiary={onTertiary ?? (() => resolve(tertiaryValue as TResult))}
            confirmVariant={confirmVariant}
            cancelVariant={cancelVariant}
            tertiaryVariant={tertiaryVariant}
            buttonPaddingStyle={buttonPaddingStyle}
            testID={testID}
            confirmTestID={confirmTestID}
            cancelTestID={cancelTestID}
        />
    )
}
