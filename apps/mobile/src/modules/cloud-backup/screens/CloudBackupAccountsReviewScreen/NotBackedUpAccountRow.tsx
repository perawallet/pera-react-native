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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupAccountRow } from '../../components/BackupAccountRow'

type NotBackedUpAccountRowProps = {
    account: WalletAccount
    isBusy: boolean
    onBackUp: (address: string) => void
}

const NotBackedUpAccountRowComponent = ({
    account,
    isBusy,
    onBackUp,
}: NotBackedUpAccountRowProps) => {
    const { t } = useLanguage()

    const handleBackUp = useCallback(
        () => onBackUp(account.address),
        [onBackUp, account.address],
    )

    return (
        <BackupAccountRow
            address={account.address}
            account={account}
            isBackedUp={false}
            trailing={
                <PWButton
                    variant='primary'
                    paddingStyle='dense'
                    title={t('cloud_backup.accounts.back_up_action')}
                    isLoading={isBusy}
                    onPress={handleBackUp}
                    testID='backup_review_back_up_button'
                />
            }
            testID={`backup_review_not_backed_up_${account.address}`}
        />
    )
}

export const NotBackedUpAccountRow = memo(NotBackedUpAccountRowComponent)
