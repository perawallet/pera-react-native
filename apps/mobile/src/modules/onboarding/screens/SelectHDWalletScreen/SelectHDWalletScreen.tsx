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

import React from 'react'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import {
    PWView,
    PWText,
    PWFlatList,
    PWRoundIcon,
    PWTouchableOpacity,
    PWButton,
    PWLoadingOverlay,
    PWScreen,
} from '@components/core'
import type { HDWalletGroup } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { ScreenHeader } from '@components/ScreenHeader'
import { Decimal } from 'decimal.js'
import { useStyles } from './styles'
import { useSelectHDWalletScreen } from './useSelectHDWalletScreen'

export const SelectHDWalletScreen = () => {
    const styles = useStyles()
    const {
        hdWalletGroups,
        accountBalances,
        isCreatingWallet,
        isSelectingWallet,
        isAutoSelecting,
        handleSelectWallet,
        handleCreateNewWallet,
        t,
    } = useSelectHDWalletScreen()

    const renderItem = ({
        item,
        index,
    }: {
        item: HDWalletGroup
        index: number
    }) => {
        const walletLabel = t('onboarding.select_hd_wallet.wallet_label', {
            number: index + 1,
        })

        const groupAlgoValue = item.accounts.reduce(
            (sum, acc) =>
                sum.plus(
                    accountBalances.get(acc.address)?.algoValue ??
                        new Decimal(0),
                ),
            new Decimal(0),
        )

        return (
            <PWTouchableOpacity
                style={styles.walletItem}
                onPress={() => handleSelectWallet(item)}
                testID={`select_hd_wallet_item_${index}`}
            >
                <PWRoundIcon
                    icon='wallet-with-algo'
                    size='lg'
                    style={styles.walletIconContainer}
                />
                <PWView style={styles.rowContent}>
                    <PWView style={styles.walletTextContainer}>
                        <PWText variant='h3'>{walletLabel}</PWText>
                        <PWText
                            variant='body'
                            style={styles.walletSubtitle}
                        >
                            {t('onboarding.select_hd_wallet.account_count', {
                                count: item.accountCount,
                            })}
                        </PWText>
                    </PWView>
                    <PWView style={styles.balanceContainer}>
                        <AssetAmount
                            asset={ALGO_ASSET}
                            value={groupAlgoValue}
                            density='compact'
                            style={styles.algoBalance}
                            variant='h4'
                        />
                        <PreferredAmount
                            sourceAssetId={ALGO_ASSET_ID}
                            sourceAmount={groupAlgoValue}
                            density='compact'
                            style={styles.fiatBalance}
                            variant='body'
                        />
                    </PWView>
                </PWView>
            </PWTouchableOpacity>
        )
    }

    return (
        <>
            <PWScreen
                scroll='never'
                footer={
                    isAutoSelecting ? undefined : (
                        <PWButton
                            title={t(
                                'onboarding.select_hd_wallet.create_new_wallet',
                            )}
                            onPress={handleCreateNewWallet}
                            variant='secondary'
                            isDisabled={isCreatingWallet || isSelectingWallet}
                            icon='plus'
                            testID='select_hd_wallet_create_new'
                        />
                    )
                }
            >
                {/* Skip the one-item picker entirely while auto-selecting. */}
                {isAutoSelecting ? null : (
                    <PWView style={styles.content}>
                        <ScreenHeader
                            title={t('onboarding.select_hd_wallet.title')}
                            description={t(
                                'onboarding.select_hd_wallet.description',
                            )}
                        />
                        <PWFlatList
                            style={styles.list}
                            data={hdWalletGroups}
                            renderItem={renderItem}
                            keyExtractor={item => item.seedKeyId}
                            extraData={accountBalances}
                        />
                    </PWView>
                )}
            </PWScreen>

            <PWLoadingOverlay
                isVisible={
                    isCreatingWallet || isSelectingWallet || isAutoSelecting
                }
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
