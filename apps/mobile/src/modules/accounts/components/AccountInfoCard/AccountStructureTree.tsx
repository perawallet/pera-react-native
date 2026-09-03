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

import {
    type IconName,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CopyableText } from '@components/CopyableText'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { AccountIcon } from '../AccountIcon'

type AccountStructureTreeProps = {
    label: string
    icon: IconName
    accounts: WalletAccount[]
    mainAccountAddress: string
    onScanAddresses: () => void
}

export const AccountStructureTree = ({
    label,
    icon,
    accounts,
    mainAccountAddress,
    onScanAddresses,
}: AccountStructureTreeProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.treeContainer}>
            <PWView style={styles.walletRow}>
                <PWView style={styles.walletCircle}>
                    <PWIcon
                        name={icon}
                        size='md'
                        variant='primary'
                    />
                </PWView>
                <PWText variant='bodyLarge'>{label}</PWText>
            </PWView>

            {accounts.map((account, index) => {
                const isMain = account.address === mainAccountAddress
                const truncated = truncateAlgorandAddress(account.address)
                const hasRealName = !!account.name && account.name !== truncated
                const fallbackLabel = isMain
                    ? t('account_info.main_address')
                    : t('account_info.sub_address')
                const isLast = index === accounts.length - 1

                return (
                    <PWView
                        // A multisig can list the same address more than once,
                        // so address alone isn't a unique key.
                        key={`${account.address}-${index}`}
                        style={styles.accountRowWithConnector}
                    >
                        <PWView style={styles.connectorContainer}>
                            <PWView
                                style={[
                                    styles.connectorVertical,
                                    isLast && styles.connectorVerticalLast,
                                ]}
                            />
                            <PWView style={styles.connectorHorizontal} />
                        </PWView>
                        <PWView style={styles.accountRow}>
                            <AccountIcon
                                account={account}
                                size='lg'
                            />
                            <PWView style={styles.accountInfo}>
                                <PWText variant='bodyLarge'>
                                    {hasRealName ? account.name : fallbackLabel}
                                </PWText>
                                <CopyableText copyValue={account.address}>
                                    <PWText
                                        variant='body'
                                        style={styles.addressText}
                                    >
                                        {truncated}
                                    </PWText>
                                </CopyableText>
                            </PWView>
                        </PWView>
                    </PWView>
                )
            })}

            <PWTouchableOpacity
                style={styles.scanButton}
                onPress={onScanAddresses}
            >
                <PWIcon
                    name='scan'
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
