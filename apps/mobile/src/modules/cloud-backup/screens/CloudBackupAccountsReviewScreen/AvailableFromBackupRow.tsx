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

import { memo, useCallback } from 'react'
import type {
    BackupItemKind,
    CachedRecordChain,
} from '@perawallet/wallet-core-backup'
import { PWButton, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupAccountRow } from '../../components/BackupAccountRow'
import { useStyles } from './styles'

type AvailableFromBackupRowProps = {
    address: string
    type: BackupItemKind | null
    chains: CachedRecordChain[]
    /** Only a newer version of the app can add it back, so there is no Add. */
    needsUpdate: boolean
    isBusy: boolean
    onAdd: (address: string) => void
    onDelete: (address: string) => Promise<void>
}

const AvailableFromBackupRowComponent = ({
    address,
    type,
    chains,
    needsUpdate,
    isBusy,
    onAdd,
    onDelete,
}: AvailableFromBackupRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const handleAdd = useCallback(() => onAdd(address), [onAdd, address])
    const handleDelete = useCallback(
        () => void onDelete(address),
        [onDelete, address],
    )

    return (
        <BackupAccountRow
            address={address}
            accountType={type}
            backupChains={chains}
            isBackedUp
            action={
                needsUpdate ? (
                    <PWText
                        variant='caption'
                        style={styles.updateHint}
                        testID='add_from_backup_needs_update'
                    >
                        {t('cloud_backup.accounts.update_to_add')}
                    </PWText>
                ) : (
                    <PWButton
                        variant='secondary'
                        icon='plus'
                        paddingStyle='dense'
                        title={t('cloud_backup.accounts.add_action')}
                        style={styles.addButton}
                        isLoading={isBusy}
                        onPress={handleAdd}
                        testID='add_from_backup_button'
                    />
                )
            }
            trailing={
                <PWButton
                    variant='destructiveLight'
                    icon='trash'
                    paddingStyle='dense'
                    onPress={handleDelete}
                    testID='delete_from_backup_button'
                />
            }
            testID={`backup_review_available_${address}`}
        />
    )
}

export const AvailableFromBackupRow = memo(AvailableFromBackupRowComponent)
