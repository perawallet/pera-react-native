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
import type {
    BackupPasskey,
    BackupPasskeyReview,
} from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFromBackupSheet } from '../../components/DeleteFromBackupSheet'
import { useBackupPasskeyReview } from '../../hooks/useBackupPasskeyReview'

type UseCloudBackupPasskeysReviewResult = {
    availableFromBackup: BackupPasskeyReview['availableFromBackup']
    notBackedUpPasskeys: BackupPasskey[]
    isLoading: boolean
    isExpanded: boolean
    busyCredentialId: string | null
    onToggleExpanded: () => void
    onAdd: (credentialId: string) => void
    onDelete: (credentialId: string) => Promise<void>
    onBackUp: (credentialId: string) => void
}

export const useCloudBackupPasskeysReview =
    (): UseCloudBackupPasskeysReviewResult => {
        const { t } = useLanguage()
        const { request: requestBottomSheet } = useBottomSheet()
        const {
            availableFromBackup,
            notBackedUpPasskeys,
            isLoading,
            busyCredentialId,
            addFromBackup,
            deleteFromBackup,
            backUpPasskey,
        } = useBackupPasskeyReview()

        // Without a Not Backed Up section below it, the collapsed card is the
        // whole screen.
        const [isExpanded, setIsExpanded] = useState(
            () => notBackedUpPasskeys.length === 0,
        )

        const onDelete = useCallback(
            async (credentialId: string) => {
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <DeleteFromBackupSheet
                            title={t(
                                'cloud_backup.passkeys.delete_sheet_title',
                            )}
                            message={t(
                                'cloud_backup.passkeys.delete_sheet_body',
                            )}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (confirmed === true) deleteFromBackup(credentialId)
            },
            [requestBottomSheet, deleteFromBackup, t],
        )

        return {
            availableFromBackup,
            notBackedUpPasskeys,
            isLoading,
            isExpanded,
            busyCredentialId,
            onToggleExpanded: useCallback(
                () => setIsExpanded(current => !current),
                [],
            ),
            onAdd: addFromBackup,
            onDelete,
            onBackUp: backUpPasskey,
        }
    }
