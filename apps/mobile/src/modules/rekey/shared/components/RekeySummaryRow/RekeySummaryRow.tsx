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

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWView } from '@components/core'
import { SHORT_ADDRESS_FORMAT } from '@constants/ui'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

export type RekeySummaryRowProps = {
    account: WalletAccount | null
    iconMode?: 'account' | 'wallet'
}

export const RekeySummaryRow = ({
    account,
    iconMode = 'account',
}: RekeySummaryRowProps) => {
    const styles = useStyles()

    if (!account) return null

    const truncated = truncateAlgorandAddress(
        account.address,
        SHORT_ADDRESS_FORMAT,
    )

    return (
        <PWView style={styles.row}>
            {iconMode === 'wallet' ? (
                <PWIcon
                    name='wallet'
                    size='lg'
                    variant='primary'
                />
            ) : (
                <AccountIcon
                    account={account}
                    size='lg'
                />
            )}
            <PWView style={styles.text}>
                <PWText
                    variant='bodyLarge'
                    numberOfLines={1}
                >
                    {account.name ?? truncated}
                </PWText>
                {!!account.name && (
                    <PWText
                        variant='body'
                        style={styles.address}
                        numberOfLines={1}
                    >
                        {truncated}
                    </PWText>
                )}
            </PWView>
        </PWView>
    )
}
