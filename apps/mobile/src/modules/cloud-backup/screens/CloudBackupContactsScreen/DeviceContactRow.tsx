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
import type { Contact } from '@perawallet/wallet-core-contacts'
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupContactRow } from '../../components/BackupContactRow'

type DeviceContactRowProps = {
    contact: Contact
    isBackedUp: boolean
    isBusy: boolean
    onBackUp: (address: string) => void
}

const DeviceContactRowComponent = ({
    contact,
    isBackedUp,
    isBusy,
    onBackUp,
}: DeviceContactRowProps) => {
    const { t } = useLanguage()

    const handleBackUp = useCallback(
        () => onBackUp(contact.address),
        [onBackUp, contact.address],
    )

    return (
        <BackupContactRow
            address={contact.address}
            name={contact.name}
            contact={contact}
            isBackedUp={isBackedUp}
            trailing={
                isBackedUp ? undefined : (
                    <PWButton
                        variant='primary'
                        paddingStyle='dense'
                        title={t('cloud_backup.contacts.back_up_action')}
                        isLoading={isBusy}
                        onPress={handleBackUp}
                        testID='cloud_backup_contact_back_up'
                    />
                )
            }
            testID={`cloud_backup_contact_${contact.address}`}
        />
    )
}

export const DeviceContactRow = memo(DeviceContactRowComponent)
