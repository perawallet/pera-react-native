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

import { useCallback, useRef } from 'react'
import {
    NoBackupCredentialsError,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { StoreBackupCredentialsSheet } from '../components/StoreBackupCredentialsSheet'
import { saveBackupCredentials, type CredentialsFileSource } from '../storage'

export type StoreCredentialsOptions = {
    /**
     * Skips this flow's own PIN check. Only for a caller that verified the PIN
     * itself moments earlier, so the user is not asked twice in a row.
     */
    hasVerifiedPin?: boolean
}

type UseStoreBackupCredentialsResult = {
    storeCredentials: (options?: StoreCredentialsOptions) => Promise<void>
}

export const useStoreBackupCredentials =
    (): UseStoreBackupCredentialsResult => {
        const { t } = useLanguage()
        const { showToast } = useToast()
        const { showError } = useErrorToast()
        const { requirePinVerification } = useRequirePinVerification()
        const { request: requestBottomSheet } = useBottomSheet()
        // A double tap would otherwise open two sheets and race two sign-ins.
        const isStoringRef = useRef(false)

        const storeCredentials = useCallback(
            async (options?: StoreCredentialsOptions) => {
                if (isStoringRef.current) return
                isStoringRef.current = true
                let destination: Optional<CredentialsFileSource>
                try {
                    // Both halves, so a backup missing only its salt fails here
                    // rather than after the sheet, the PIN and a cloud sign-in.
                    const { salt, backupId } = useCloudBackupStore.getState()
                    if (!salt || !backupId) {
                        throw new NoBackupCredentialsError()
                    }

                    destination =
                        await requestBottomSheet<CredentialsFileSource>({
                            contents: <StoreBackupCredentialsSheet />,
                            options: {
                                size: 'auto',
                                enablePanDownToClose: true,
                                autoCreateContainer: false,
                            },
                        })
                    if (!destination) return
                    if (
                        !options?.hasVerifiedPin &&
                        !(await requirePinVerification())
                    ) {
                        return
                    }

                    // Re-reads the store, so a backup deleted while the sheet
                    // and PIN were open stops here.
                    const result = await saveBackupCredentials(destination)
                    if (result === 'cancelled') return
                    showToast(
                        {
                            title: t('cloud_backup.store_credentials.success'),
                            body: '',
                            type: 'success',
                        },
                        // Lets a dismissing native picker or sign-in sheet clear first.
                        { delayLength: 'short' },
                    )
                } catch (error) {
                    logger.error(
                        'useStoreBackupCredentials: failed to store the encryption key',
                        { destination, error },
                    )
                    showError(error, t('cloud_backup.store_credentials.error'))
                } finally {
                    isStoringRef.current = false
                }
            },
            [
                requestBottomSheet,
                requirePinVerification,
                showError,
                showToast,
                t,
            ],
        )

        return { storeCredentials }
    }
