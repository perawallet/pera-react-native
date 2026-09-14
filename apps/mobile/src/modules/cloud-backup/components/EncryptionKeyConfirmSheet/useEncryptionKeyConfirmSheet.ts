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

import { useCallback, useState } from 'react'
import { useCloudBackupDraftStore } from '@perawallet/wallet-core-backup'
import { bottomSheetNotifier } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useClipboard } from '@hooks/useClipboard'

export type EncryptionKeyConfirmResult = 'enable' | 'show-credentials'

type UseEncryptionKeyConfirmSheetResult = {
    salt: string
    isConfirmed: boolean
    toggleConfirmed: () => void
    handleCopy: () => void
    handleEnable: () => void
    handleShowCredentials: () => void
}

export const useEncryptionKeyConfirmSheet =
    (): UseEncryptionKeyConfirmSheetResult => {
        const { copyToClipboard } = useClipboard()
        const { resolve } = useBottomSheetResult<EncryptionKeyConfirmResult>()
        const salt = useCloudBackupDraftStore(state => state.salt) ?? ''

        const [isConfirmed, setIsConfirmed] = useState(false)

        const toggleConfirmed = useCallback(
            () => setIsConfirmed(value => !value),
            [],
        )

        const handleCopy = useCallback(() => {
            // Without the sheet's own notifier the "Copied" toast renders
            // behind the sheet, and it is the only feedback this button gives.
            void copyToClipboard(salt, bottomSheetNotifier.current ?? undefined)
        }, [copyToClipboard, salt])

        const handleEnable = useCallback(() => resolve('enable'), [resolve])

        const handleShowCredentials = useCallback(
            () => resolve('show-credentials'),
            [resolve],
        )

        return {
            salt,
            isConfirmed,
            toggleConfirmed,
            handleCopy,
            handleEnable,
            handleShowCredentials,
        }
    }
