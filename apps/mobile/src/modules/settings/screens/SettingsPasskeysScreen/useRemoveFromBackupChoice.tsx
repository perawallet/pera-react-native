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
    getBackupSyncManager,
    isPasskeyBackedUp,
    useBackupSyncStateStore,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import type { Passkey } from '@perawallet/wallet-core-passkeys'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFromBackupSheet } from '@modules/cloud-backup'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

/** Resolves to `true` when removal may proceed. Shared by the native and web
 *  screens: both reach the same Cloud Backup stack, so a credential removed on
 *  either has to land in one bucket or the other. A refused or dismissed choice
 *  would strand it in neither, so removal is abandoned rather than run anyway. */
export type RemoveFromBackupChoice = (passkey: Passkey) => Promise<boolean>

export const useRemoveFromBackupChoice = (): RemoveFromBackupChoice => {
    const { request } = useBottomSheet()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const isCloudBackupEnabled = useIsCloudBackupEnabled()
    const syncState = useBackupSyncStateStore(state => state.syncState)

    return useCallback(
        async (passkey: Passkey) => {
            // The backup keys on the raw keystore id, not the base64url `id`
            // WebAuthn uses.
            if (
                !isCloudBackupEnabled ||
                !isPasskeyBackedUp(syncState, passkey.keyId)
            )
                return true

            const choice = await request<boolean>({
                contents: (
                    <DeleteFromBackupSheet
                        title={t('cloud_backup.passkeys.delete_sheet_title')}
                        message={t('cloud_backup.passkeys.delete_sheet_body')}
                        declineLabel={t('cloud_backup.accounts.keep_action')}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (choice === undefined) return false

            try {
                const isRecorded = choice
                    ? (await getBackupSyncManager().deletePasskeyFromBackup(
                          passkey.keyId,
                      )) !== 'refused'
                    : await getBackupSyncManager().keepPasskeyInBackup(
                          passkey.keyId,
                          passkey.displayName,
                      )
                if (isRecorded) return true
            } catch (error) {
                logger.warn('useRemoveFromBackupChoice: choice failed', {
                    credentialId: passkey.keyId,
                    error:
                        error instanceof Error ? error.message : String(error),
                })
            }

            showToast({
                title: t(
                    choice
                        ? 'cloud_backup.passkeys.delete_error'
                        : 'cloud_backup.passkeys.keep_error',
                ),
                body: '',
                type: 'error',
            })
            return false
        },
        [isCloudBackupEnabled, syncState, request, showToast, t],
    )
}
