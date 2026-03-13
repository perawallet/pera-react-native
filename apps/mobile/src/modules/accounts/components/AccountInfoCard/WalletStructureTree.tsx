/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    PWIcon,
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { HDWalletAccount } from '@perawallet/wallet-core-accounts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { AccountIcon } from '../AccountIcon'
type WalletStructureTreeProps = {
    walletLabel: string
    accounts: HDWalletAccount[]
    onScanAddresses: () => void
}

export const WalletStructureTree = ({
    walletLabel,
    accounts,
    onScanAddresses,
}: WalletStructureTreeProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.treeContainer}>
            <PWView style={styles.walletRow}>
                <PWRoundIcon
                    icon='wallet'
                    variant='secondary'
                    size='lg'
                />
                <PWText variant='body'>{walletLabel}</PWText>
            </PWView>

            {accounts.map(account => (
                <PWView
                    key={account.address}
                    style={styles.accountRowWithConnector}
                >
                    <PWView style={styles.connectorContainer}>
                        <PWView style={styles.connectorVertical} />
                        <PWView style={styles.connectorHorizontal} />
                    </PWView>
                    <PWView style={styles.accountRow}>
                        <AccountIcon
                            account={account}
                            size='md'
                        />
                        <PWView style={styles.accountInfo}>
                            <PWText variant='body'>
                                {account.name ?? t('account_info.main_address')}
                            </PWText>
                            <PWText
                                variant='body'
                                style={styles.addressText}
                            >
                                {truncateAlgorandAddress(account.address)}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            ))}

            <PWTouchableOpacity
                style={styles.scanButton}
                onPress={onScanAddresses}
            >
                <PWIcon
                    name='magnifying-glass'
                    size='sm'
                    variant='helper'
                />
                <PWText
                    variant='link'
                    style={styles.scanButtonText}
                >
                    {t('account_info.scan_new_addresses')}
                </PWText>
            </PWTouchableOpacity>
        </PWView>
    )
}
