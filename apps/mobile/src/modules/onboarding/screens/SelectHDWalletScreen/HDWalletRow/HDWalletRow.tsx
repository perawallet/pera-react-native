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
    PWRoundIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIconStack } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import { useHDWalletRow } from './useHDWalletRow'

export type HDWalletRowProps = {
    group: HdSeedGroup
    /** Position in the picker; the label numbers wallets from 1. */
    index: number
    onPress: (group: HdSeedGroup) => void
}

export const HDWalletRow = ({ group, index, onPress }: HDWalletRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { fiatTotal, hasFiatTotal, chainIds, isMultichain } =
        useHDWalletRow(group)

    return (
        <PWTouchableOpacity
            style={styles.walletItem}
            onPress={() => onPress(group)}
            testID={`select_hd_wallet_item_${index}`}
        >
            <PWRoundIcon
                icon='wallet-with-algo'
                size='lg'
                style={styles.walletIconContainer}
            />
            <PWView style={styles.rowContent}>
                <PWView style={styles.walletTextContainer}>
                    <PWText variant='h3'>
                        {t('onboarding.select_hd_wallet.wallet_label', {
                            number: index + 1,
                        })}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.walletSubtitle}
                    >
                        {t('onboarding.select_hd_wallet.account_count', {
                            count: group.accountCount,
                        })}
                    </PWText>
                </PWView>
                <PWView style={styles.balanceContainer}>
                    {hasFiatTotal && (
                        <PreferredAmount
                            value={fiatTotal}
                            density='compact'
                            variant='h4'
                        />
                    )}
                    {isMultichain && <ChainIconStack chainIds={chainIds} />}
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
