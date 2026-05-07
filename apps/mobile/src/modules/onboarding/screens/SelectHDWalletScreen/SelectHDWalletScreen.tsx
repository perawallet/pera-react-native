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

import React from 'react'
import {
    PWView,
    PWText,
    PWFlatList,
    PWRoundIcon,
    PWTouchableOpacity,
    PWButton,
    PWLoadingOverlay,
    PWFooter,
} from '@components/core'
import { type HDWalletGroup } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { Decimal } from 'decimal.js'
import { useStyles } from './styles'
import { useSelectHDWalletScreen } from './useSelectHDWalletScreen'

export const SelectHDWalletScreen = () => {
    const styles = useStyles()
    const {
        hdWalletGroups,
        accountBalances,
        isCreatingWallet,
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
                    <CurrencyDisplay
                        currency='ALGO'
                        value={groupAlgoValue}
                        precision={ALGO_ASSET.decimals}
                        minPrecision={2}
                        style={styles.algoBalance}
                        variant='h4'
                    />
                    <PreferredCurrencyDisplay
                        sourceAssetId={ALGO_ASSET_ID}
                        sourceAmount={groupAlgoValue}
                        precision={2}
                        minPrecision={2}
                        style={styles.fiatBalance}
                        variant='body'
                    />
                </PWView>
            </PWTouchableOpacity>
        )
    }

    return (
        <>
            <PWView style={styles.container}>
                <PWView style={styles.content}>
                    <PWText
                        variant='h1'
                        style={styles.title}
                    >
                        {t('onboarding.select_hd_wallet.title')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.description}
                    >
                        {t('onboarding.select_hd_wallet.description')}
                    </PWText>
                    <PWFlatList
                        style={styles.list}
                        data={hdWalletGroups}
                        renderItem={renderItem}
                        keyExtractor={item => item.keyPairId}
                        extraData={accountBalances}
                        contentContainerStyle={styles.listContent}
                    />
                </PWView>
                <PWFooter style={styles.footer}>
                    <PWButton
                        title={t(
                            'onboarding.select_hd_wallet.create_new_wallet',
                        )}
                        onPress={handleCreateNewWallet}
                        variant='secondary'
                        isDisabled={isCreatingWallet}
                        icon='plus'
                        testID='select_hd_wallet_create_new'
                    />
                </PWFooter>
            </PWView>

            <PWLoadingOverlay
                isVisible={isCreatingWallet}
                title={t('onboarding.create_account.processing')}
            />
        </>
    )
}
