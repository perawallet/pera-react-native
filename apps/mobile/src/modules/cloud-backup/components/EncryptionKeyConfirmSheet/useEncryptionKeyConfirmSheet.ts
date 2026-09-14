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
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type EncryptionKeyConfirmResult = 'enable' | 'show-credentials'

type UseEncryptionKeyConfirmSheetResult = {
    salt: string
    isConfirmed: boolean
    toggleConfirmed: () => void
    handleEnable: () => void
    handleShowCredentials: () => void
}

export const useEncryptionKeyConfirmSheet =
    (): UseEncryptionKeyConfirmSheetResult => {
        const { resolve } = useBottomSheetResult<EncryptionKeyConfirmResult>()
        const salt = useCloudBackupDraftStore(state => state.salt) ?? ''

        const [isConfirmed, setIsConfirmed] = useState(false)

        const toggleConfirmed = useCallback(() => {
            if (!isConfirmed) trackEvent(CloudBackupEvent.ConfirmStoredCheck)
            setIsConfirmed(value => !value)
        }, [isConfirmed])

        const handleEnable = useCallback(() => {
            trackEvent(CloudBackupEvent.ConfirmEnable)
            resolve('enable')
        }, [resolve])

        const handleShowCredentials = useCallback(() => {
            trackEvent(CloudBackupEvent.ConfirmShowCredentials)
            resolve('show-credentials')
        }, [resolve])

        return {
            salt,
            isConfirmed,
            toggleConfirmed,
            handleEnable,
            handleShowCredentials,
        }
    }
