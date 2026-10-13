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
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupPasskeyRow } from '../../components/BackupPasskeyRow'
import { useStyles } from './styles'

type AvailablePasskeyRowProps = {
    credentialId: string
    label: string
    isBusy: boolean
    onAdd: (credentialId: string) => void
    onDelete: (credentialId: string) => Promise<void>
}

const AvailablePasskeyRowComponent = ({
    credentialId,
    label,
    isBusy,
    onAdd,
    onDelete,
}: AvailablePasskeyRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const handleAdd = useCallback(
        () => onAdd(credentialId),
        [onAdd, credentialId],
    )
    const handleDelete = useCallback(
        () => void onDelete(credentialId),
        [onDelete, credentialId],
    )

    return (
        <BackupPasskeyRow
            label={label}
            isBackedUp
            action={
                <PWButton
                    variant='secondary'
                    icon='plus'
                    paddingStyle='dense'
                    title={t('cloud_backup.passkeys.add_action')}
                    style={styles.addButton}
                    isLoading={isBusy}
                    onPress={handleAdd}
                    testID='add_passkey_from_backup_button'
                />
            }
            trailing={
                <PWButton
                    variant='destructiveLight'
                    icon='trash'
                    paddingStyle='dense'
                    onPress={handleDelete}
                    testID='delete_passkey_from_backup_button'
                />
            }
            testID={`backup_review_available_passkey_${credentialId}`}
        />
    )
}

export const AvailablePasskeyRow = memo(AvailablePasskeyRowComponent)
