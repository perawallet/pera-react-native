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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWView, type PWViewProps } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ChainBadge } from '@components/ChainBadge'
import { ChainUnavailableNotice } from '@components/ChainNotice'
import { PreferredAmount } from '@components/PreferredAmount'
import { useStyles } from './styles'
import { useAccountWithBalance } from './useAccountWithBalance'

export type AccountWithBalanceProps = {
    account: WalletAccount
    isHighlighted?: boolean
    /** The chain whose address, balance and native asset to show; defaults to the account's own chain. */
    chainId?: ChainId
} & PWViewProps

export const AccountWithBalance = ({
    account,
    isHighlighted,
    chainId,
    ...rest
}: AccountWithBalanceProps) => {
    const styles = useStyles({ isHighlighted })
    const {
        scope,
        chainName,
        availability,
        nativeValue,
        preferredValue,
        isMultiChain,
        crossChainTotal,
    } = useAccountWithBalance(account, chainId)
    // A chain-agnostic row stands for every chain the account is on, so no one
    // chain's badge applies. No row carries a TestNet badge: developer mode puts
    // every chain on a test network at once, and the app-wide bar already says so.
    const badges =
        !crossChainTotal && isMultiChain && !!chainName ? (
            <ChainBadge name={chainName} />
        ) : undefined

    const renderBalance = () => {
        if (crossChainTotal) {
            switch (crossChainTotal.kind) {
                case 'unavailable': {
                    return (
                        <ChainUnavailableNotice testID='account_chain_unavailable' />
                    )
                }
                case 'testOnly': {
                    return null
                }
                case 'fiat': {
                    return (
                        <PWView style={styles.balanceContainer}>
                            <PreferredAmount
                                value={crossChainTotal.value}
                                density='compact'
                                variant='bodyLarge'
                                weight={500}
                            />
                        </PWView>
                    )
                }
            }
        }
        if (!availability.isAvailable) {
            return (
                <ChainUnavailableNotice
                    chainName={chainName}
                    testID='account_chain_unavailable'
                />
            )
        }
        return (
            <PWView style={styles.balanceContainer}>
                <AssetAmount
                    asset={availability.nativeAsset}
                    value={nativeValue}
                    density='compact'
                    variant='bodyLarge'
                    weight={500}
                />
                {isMultiChain ? (
                    // Re-pricing the native balance would read a missing
                    // price as $0; the account's own fiat value keeps it unknown.
                    <PreferredAmount
                        value={preferredValue}
                        density='compact'
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.fiatBalance}
                    />
                ) : (
                    // Converts on the account's own chain, which keeps the
                    // ALGO-preferred fallback for an ALGO balance.
                    <PreferredAmount
                        sourceAssetId={availability.nativeAsset.assetId}
                        sourceAmount={nativeValue}
                        scope={scope}
                        density='compact'
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.fiatBalance}
                    />
                )}
            </PWView>
        )
    }

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <AccountDisplay
                account={account}
                chainId={chainId}
                showChevron={false}
                showAccountType
                alwaysShowAccountType={!!crossChainTotal}
                badges={badges}
                style={styles.accountDisplay}
            />
            {renderBalance()}
        </PWView>
    )
}
