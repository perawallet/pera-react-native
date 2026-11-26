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

import { Trans } from 'react-i18next'
import type { AccountChainAssetBalance } from '@perawallet/wallet-core-accounts'
import type { SwapPayHolding } from '@perawallet/wallet-core-swaps'
import { PWScrollView, PWText } from '@components/core'
import { SwapSourceAccountCard } from './SwapSourceAccountCard'
import { useStyles } from './styles'
import { useSwapSourceAccountList } from './useSwapSourceAccountList'

export type SwapSourceAccountListProps = {
    holding: SwapPayHolding
    onSelect: (holder: AccountChainAssetBalance) => void
}

export const SwapSourceAccountList = ({
    holding,
    onSelect,
}: SwapSourceAccountListProps) => {
    const styles = useStyles()
    const { options, networkLabelOf } = useSwapSourceAccountList(holding)

    return (
        <PWScrollView contentContainerStyle={styles.content}>
            <PWText style={styles.subtitle}>
                <Trans
                    i18nKey='swap.source_account.subtitle'
                    values={{ accounts: options.length }}
                    components={[
                        <PWText
                            key='bold'
                            variant='bodySemibold'
                        />,
                    ]}
                />
            </PWText>
            {options.map(({ account, holding: holder }) => (
                <SwapSourceAccountCard
                    key={account.id}
                    account={account}
                    holding={holder}
                    networkLabel={networkLabelOf(holder.scope.chainId)}
                    onSelect={onSelect}
                />
            ))}
        </PWScrollView>
    )
}
