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
import type { HdSeedGroup } from '@perawallet/wallet-core-accounts'
import {
    PWView,
    PWFlatList,
    PWButton,
    PWLoadingOverlay,
    PWScreen,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { HDWalletRow } from './HDWalletRow'
import { useStyles } from './styles'
import { useSelectHDWalletScreen } from './useSelectHDWalletScreen'

export const SelectHDWalletScreen = () => {
    const styles = useStyles()
    const {
        hdSeedGroups,
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
        item: HdSeedGroup
        index: number
    }) => (
        <HDWalletRow
            group={item}
            index={index}
            onPress={handleSelectWallet}
        />
    )

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
                            data={hdSeedGroups}
                            renderItem={renderItem}
                            keyExtractor={item => item.seedKeyId}
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
