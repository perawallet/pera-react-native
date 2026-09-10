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
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { BackupContactReview } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFromBackupSheet } from '../../components/DeleteFromBackupSheet'
import { useBackupContactReview } from '../../hooks/useBackupContactReview'

type UseCloudBackupContactsReviewResult = {
    availableFromBackup: BackupContactReview['availableFromBackup']
    notBackedUpContacts: Contact[]
    isExpanded: boolean
    busyAddress: string | null
    onToggleExpanded: () => void
    onAdd: (address: string) => void
    onDelete: (address: string) => Promise<void>
    onBackUp: (address: string) => void
}

export const useCloudBackupContactsReview =
    (): UseCloudBackupContactsReviewResult => {
        const { t } = useLanguage()
        const { request: requestBottomSheet } = useBottomSheet()
        const {
            availableFromBackup,
            notBackedUpContacts,
            busyAddress,
            addFromBackup,
            deleteFromBackup,
            backUpContact,
        } = useBackupContactReview()

        // Without a Not Backed Up section below it, the collapsed card is the
        // whole screen.
        const [isExpanded, setIsExpanded] = useState(
            () => notBackedUpContacts.length === 0,
        )

        const onDelete = useCallback(
            async (address: string) => {
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <DeleteFromBackupSheet
                            title={t(
                                'cloud_backup.contacts.delete_sheet_title',
                            )}
                            message={t(
                                'cloud_backup.contacts.delete_sheet_body',
                            )}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (confirmed === true) deleteFromBackup(address)
            },
            [requestBottomSheet, deleteFromBackup, t],
        )

        return {
            availableFromBackup,
            notBackedUpContacts,
            isExpanded,
            busyAddress,
            onToggleExpanded: useCallback(
                () => setIsExpanded(current => !current),
                [],
            ),
            onAdd: addFromBackup,
            onDelete,
            onBackUp: backUpContact,
        }
    }
