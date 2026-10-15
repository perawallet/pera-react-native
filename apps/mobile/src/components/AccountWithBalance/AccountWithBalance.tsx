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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWBadge, PWView, type PWViewProps } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainBadge } from '@components/ChainBadge'
import { ChainNotice } from '@components/ChainNotice'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountWithBalance } from './useAccountWithBalance'

export type AccountWithBalanceProps = {
    account: WalletAccount
    isHighlighted?: boolean
} & PWViewProps

export const AccountWithBalance = ({
    account,
    isHighlighted,
    ...rest
}: AccountWithBalanceProps) => {
    const styles = useStyles({ isHighlighted })
    const { t } = useLanguage()
    const {
        chainId,
        chainName,
        nativeAsset,
        nativeValue,
        preferredValue,
        isMultiChain,
        isTestTier,
        isChainSwitchedOff,
    } = useAccountWithBalance(account)

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AccountDisplay
                account={account}
                showChevron={false}
                showAccountType
                style={styles.accountDisplay}
            />
            {isMultiChain && <ChainBadge chainId={chainId} />}
            {isTestTier && (
                <PWBadge
                    variant='testnet'
                    value={t('common.network_label.testnet')}
                />
            )}
            {isChainSwitchedOff || !nativeAsset ? (
                <ChainNotice
                    kind='warning'
                    titleKey='accounts.chain_unavailable'
                    params={{ chain: chainName }}
                    testID='account_chain_unavailable'
                />
            ) : (
                <PWView style={styles.balanceContainer}>
                    <AssetAmount
                        asset={nativeAsset}
                        value={nativeValue}
                        density='compact'
                        variant='bodyLarge'
                        weight={500}
                    />
                    {isMultiChain ? (
                        <PreferredAmount
                            value={preferredValue}
                            density='compact'
                            variant='footnoteMedium'
                            weight={400}
                            style={styles.fiatBalance}
                        />
                    ) : (
                        <PreferredAmount
                            sourceAssetId={nativeAsset.assetId}
                            sourceAmount={nativeValue}
                            density='compact'
                            variant='footnoteMedium'
                            weight={400}
                            style={styles.fiatBalance}
                        />
                    )}
                </PWView>
            )}
        </PWView>
    )
}
