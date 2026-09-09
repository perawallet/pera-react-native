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
import {
    encryptBackupSyncQr,
    useCloudBackupStore,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { useBottomSheet } from '@modules/bottom-sheet'
import { PinEditContent, useRequirePinVerification } from '@modules/security'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { SyncDevicesQrSheet } from '../components/SyncDevicesQrSheet'

type UseSyncDevicesQrResult = {
    showSyncQr: () => Promise<void>
}

export const useSyncDevicesQr = (): UseSyncDevicesQrResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { requirePinVerification } = useRequirePinVerification()
    const { request: requestBottomSheet } = useBottomSheet()
    const backupSalt = useCloudBackupStore(state => state.salt)

    // A PIN-shaped flow that deliberately sets no PIN: the confirmed code is
    // handed back here and never reaches the keystore.
    const requestEncryptionCode = useCallback(async (): Promise<
        string | null
    > => {
        const collected: { code: string | null } = { code: null }
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <PinEditContent
                    mode='setup'
                    title={t('cloud_backup.encryption_code.setup_title')}
                    confirmTitle={t(
                        'cloud_backup.encryption_code.confirm_title',
                    )}
                    onPinConfirmed={async code => {
                        collected.code = code
                        return { ok: true }
                    }}
                />
            ),
            options: {
                size: 'full',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
        return confirmed === true ? collected.code : null
    }, [requestBottomSheet, t])

    const showSyncQr = useCallback(async () => {
        if (!backupSalt) {
            showError(
                new Error('No backup salt is stored on this device'),
                t('cloud_backup.sync_devices.error'),
            )
            return
        }
        if (!(await requirePinVerification())) return

        const code = await requestEncryptionCode()
        if (!code) return

        let payload: string | null = null
        try {
            // The whole seal runs inside the accessor: it zeroes the index
            // buffer as soon as this handler returns, so the words must be
            // consumed here and only the ciphertext may leave.
            payload = await withBackupMnemonicIndices(indices =>
                encryptBackupSyncQr({
                    mnemonic: Array.from(indices, mnemonicIndexToWord).join(
                        ' ',
                    ),
                    backupSalt,
                    code,
                }),
            )
        } catch (error) {
            showError(error, t('cloud_backup.sync_devices.error'))
            return
        }

        if (!payload) {
            showError(
                new Error('No backup phrase is stored on this device'),
                t('cloud_backup.sync_devices.error'),
            )
            return
        }

        await requestBottomSheet({
            contents: <SyncDevicesQrSheet payload={payload} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [
        backupSalt,
        requirePinVerification,
        requestEncryptionCode,
        requestBottomSheet,
        showError,
        t,
    ])

    return { showSyncQr }
}
