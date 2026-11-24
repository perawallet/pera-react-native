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

import { memo } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useIsAccountCoveredByCloudBackup } from '@perawallet/wallet-core-backup'
import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type CloudBackupStatusProps = {
    account: WalletAccount
}

const CloudBackupStatusComponent = ({ account }: CloudBackupStatusProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isCovered = useIsAccountCoveredByCloudBackup(account)

    if (!isCovered) return null

    return (
        <PWView
            style={styles.container}
            testID='cloud_backup_status'
        >
            <PWIcon
                name='cloud-check'
                variant='secondary'
                size='sm'
            />
            <PWText
                variant='footnoteMedium'
                style={styles.label}
            >
                {t('backup.status.cloud_backup')}
            </PWText>
        </PWView>
    )
}

export const CloudBackupStatus = memo(CloudBackupStatusComponent)
