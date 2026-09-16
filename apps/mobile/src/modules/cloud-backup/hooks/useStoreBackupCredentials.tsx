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
    BACKUP_CREDENTIALS_FILE_NAME,
    buildBackupCredentialsFile,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { StoreBackupCredentialsSheet } from '../components/StoreBackupCredentialsSheet'
import {
    saveToDevice,
    saveToGoogleDrive,
    saveToICloud,
    type CredentialsFileSaver,
    type CredentialsFileSource,
} from '../storage'

const SAVERS: Record<CredentialsFileSource, CredentialsFileSaver> = {
    device: saveToDevice,
    icloud: saveToICloud,
    googleDrive: saveToGoogleDrive,
}

type UseStoreBackupCredentialsResult = {
    storeCredentials: () => Promise<void>
}

const NO_SALT_MESSAGE = 'No backup salt is stored on this device'

export const useStoreBackupCredentials =
    (): UseStoreBackupCredentialsResult => {
        const { t } = useLanguage()
        const { showToast } = useToast()
        const { showError } = useErrorToast()
        const { requirePinVerification } = useRequirePinVerification()
        const { request: requestBottomSheet } = useBottomSheet()
        // A double tap would otherwise open two sheets and race two sign-ins.
        const isStoringRef = useRef(false)

        const storeCredentials = useCallback(async () => {
            if (isStoringRef.current) return
            isStoringRef.current = true
            let destination: Optional<CredentialsFileSource>
            try {
                if (!useCloudBackupStore.getState().salt) {
                    throw new Error(NO_SALT_MESSAGE)
                }

                destination = await requestBottomSheet<CredentialsFileSource>({
                    contents: <StoreBackupCredentialsSheet />,
                    options: {
                        size: 'auto',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
                if (!destination) return
                if (!(await requirePinVerification())) return

                // Read again: a backup deleted elsewhere while the sheet and
                // PIN were open resets the store.
                const backupSalt = useCloudBackupStore.getState().salt
                if (!backupSalt) throw new Error(NO_SALT_MESSAGE)

                const result = await SAVERS[destination](
                    BACKUP_CREDENTIALS_FILE_NAME,
                    buildBackupCredentialsFile(backupSalt),
                )
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
        }, [
            requestBottomSheet,
            requirePinVerification,
            showError,
            showToast,
            t,
        ])

        return { storeCredentials }
    }
