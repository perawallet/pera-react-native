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

import { useCallback } from 'react'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    PWView,
    PWText,
    PWButton,
    PWFlatList,
    PWLoadingIndicator,
} from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@components/AccountDisplay'
import { AccountAssetItemView } from '@modules/assets'
import {
    useLedgerAccountInfoContent,
    type LedgerInfoListItem,
} from './useLedgerAccountInfoContent'
import { useStyles } from './styles'

// This sheet is always about one connected Ledger, so a forced rekeyed state
// is a rekey to hardware; the auth account isn't in the store to look up.
const LEDGER_AUTH_ACCOUNT: HardwareWalletAccount = {
    id: 'ledger-auth',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: '',
            deviceName: '',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: {},
}

export type LedgerAccountInfoContentProps = {
    address: string
    accountIndex: number
    title?: string
}

export const LedgerAccountInfoContent = ({
    address,
    accountIndex,
    title,
}: LedgerAccountInfoContentProps) => {
    const nativeAsset = useNativeAsset()
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        title: resolvedTitle,
        items,
        isLoading,
        isError,
        refetch,
    } = useLedgerAccountInfoContent(address, accountIndex, title)

    const renderItem = useCallback(
        ({ item }: { item: LedgerInfoListItem }) => {
            switch (item.kind) {
                case 'sectionHeader': {
                    return (
                        <PWText
                            variant='h4'
                            style={styles.sectionHeader}
                        >
                            {item.title}
                        </PWText>
                    )
                }

                case 'account': {
                    return (
                        <PWView style={styles.accountRow}>
                            <AccountDisplay
                                account={item.account}
                                showChevron={false}
                                showAccountType
                                iconProps={{
                                    displayState: item.displayStateOverride,
                                    authAccount: LEDGER_AUTH_ACCOUNT,
                                }}
                            />
                            <PWView style={styles.balanceContainer}>
                                <AssetAmount
                                    asset={nativeAsset}
                                    value={item.algoBalance}
                                    density='compact'
                                    variant='bodyCompact'
                                />
                                <PreferredAmount
                                    sourceAssetId={nativeAsset.assetId}
                                    sourceAmount={item.algoBalance}
                                    usdPrice={item.algoUsdPrice}
                                    density='compact'
                                    variant='bodyCompact'
                                    style={styles.fiatBalance}
                                />
                            </PWView>
                        </PWView>
                    )
                }

                case 'asset': {
                    if (!item.hasKnownDecimals) {
                        // Unknown decimals: the raw amount is base units and
                        // must not render as a balance (1.5 USDC → 1,500,000).
                        return (
                            <PWView style={styles.unknownAssetRow}>
                                <AccountAssetItemView
                                    accountBalance={item.accountBalance}
                                    showBalance={false}
                                    style={styles.unknownAssetInfo}
                                />
                                <PWText
                                    variant='body'
                                    style={styles.secondary}
                                    testID={`ledger_asset_unknown_${item.accountBalance.assetId}`}
                                >
                                    {'—'}
                                </PWText>
                            </PWView>
                        )
                    }
                    return (
                        <AccountAssetItemView
                            accountBalance={item.accountBalance}
                            usdPrice={item.usdPrice}
                        />
                    )
                }

                case 'authorityAccount': {
                    return (
                        <AccountDisplay
                            account={item.account}
                            showChevron={false}
                            showAccountType
                            style={styles.rekeyRow}
                            iconProps={{
                                displayState: item.displayStateOverride,
                                authAccount: LEDGER_AUTH_ACCOUNT,
                            }}
                        />
                    )
                }
            }
        },
        [styles, nativeAsset],
    )

    return (
        <PWView style={styles.container}>
            <SheetHeader title={resolvedTitle} />

            {isLoading && (
                <PWView
                    style={styles.centerState}
                    testID='ledger_account_info_loading'
                >
                    <PWLoadingIndicator />
                </PWView>
            )}

            {isError && !isLoading && (
                <PWView
                    style={styles.centerState}
                    testID='ledger_account_info_error'
                >
                    <PWText
                        variant='body'
                        style={styles.secondary}
                    >
                        {t('ledger.account_info.error')}
                    </PWText>
                    <PWButton
                        variant='secondary'
                        title={t('ledger.account_info.retry')}
                        onPress={refetch}
                        testID='ledger_account_info_retry'
                    />
                </PWView>
            )}

            {!isLoading && !isError && (
                <PWFlatList
                    inBottomSheet
                    data={items}
                    renderItem={renderItem}
                    ItemSeparatorComponent={null}
                    keyExtractor={(item: LedgerInfoListItem) => item.key}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    testID='ledger_account_info_list'
                />
            )}
        </PWView>
    )
}
