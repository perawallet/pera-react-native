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

import {
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountInfoCard } from './useAccountInfoCard'
import { AccountIcon } from '../AccountIcon'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { WalletStructureTree } from './WalletStructureTree'
import { InfoButton } from '@components/InfoButton'
import { AccountTypeInfoContent } from './AccountTypeInfoContent'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'

export type AccountInfoCardProps = {
    account: WalletAccount
    onClose: () => void
}

export const AccountInfoCard = ({ account, onClose }: AccountInfoCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isExpanded,
        handleToggleExpanded,
        accountTypeLabel,
        minBalanceAlgos,
        isMinBalanceLoading,
        showMinBalance,
        showStructure,
        structureLabel,
        structureAccounts,
        handleScanAddresses,
    } = useAccountInfoCard({ account, onClose })

    const chevronStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    rotate: withTiming(isExpanded ? '180deg' : '0deg', {
                        duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                    }),
                },
            ],
        }
    }, [isExpanded])

    return (
        <PWView style={styles.card}>
            {/* Account type row */}
            <PWView style={styles.infoRow}>
                <PWText
                    variant='body'
                    style={styles.labelText}
                >
                    {t('account_info.account_type')}
                </PWText>
                <PWView style={styles.infoRowValue}>
                    <AccountIcon
                        account={account}
                        size='sm'
                    />
                    <PWText variant='h4'>{accountTypeLabel}</PWText>
                    <InfoButton>
                        <AccountTypeInfoContent
                            account={account}
                            onClose={onClose}
                        />
                    </InfoButton>
                </PWView>
            </PWView>

            {/* Min balance row */}
            {showMinBalance && (
                <PWView style={styles.infoRow}>
                    <PWText
                        variant='body'
                        style={styles.labelText}
                    >
                        {t('account_info.min_balance')}
                    </PWText>
                    <PWView style={styles.infoRowValue}>
                        <CurrencyDisplay
                            currency='ALGO'
                            value={minBalanceAlgos}
                            precision={ALGO_ASSET.decimals}
                            minPrecision={2}
                            showSymbol
                            symbolPosition='start'
                            isLoading={isMinBalanceLoading}
                            variant='h4'
                        />
                        <InfoButton title={t('min_balance_info.title')}>
                            <PWText style={styles.minBalanceDescription}>
                                {t('min_balance_info.description')}
                            </PWText>
                        </InfoButton>
                    </PWView>
                </PWView>
            )}

            {/* Wallet structure (HD wallets and Ledger devices) */}
            {showStructure && (
                <>
                    <ExpandablePanel isExpanded={isExpanded}>
                        <WalletStructureTree
                            walletLabel={structureLabel}
                            accounts={structureAccounts}
                            onScanAddresses={handleScanAddresses}
                        />
                    </ExpandablePanel>

                    <PWView style={styles.toggleSection}>
                        <PWDivider style={styles.toggleDivider} />
                        <PWTouchableOpacity
                            onPress={handleToggleExpanded}
                            style={styles.toggleButton}
                        >
                            <PWText
                                variant='body'
                                style={styles.toggleText}
                            >
                                {isExpanded
                                    ? t('account_info.hide_wallet_structure')
                                    : t('account_info.see_wallet_structure')}
                            </PWText>
                            <Animated.View style={chevronStyle}>
                                <PWIcon
                                    name='chevron-down'
                                    size='sm'
                                    variant='secondary'
                                />
                            </Animated.View>
                        </PWTouchableOpacity>
                    </PWView>
                </>
            )}
        </PWView>
    )
}
