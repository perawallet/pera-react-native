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

import type { ReactNode } from 'react'
import {
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountInfoCard } from './useAccountInfoCard'
import { AccountIcon } from '../AccountIcon'
import { AssetAmount } from '@components/AssetAmount'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { AccountStructureTree } from './AccountStructureTree'
import { InfoButton, useInfoButton } from '@components/InfoButton'
import { AccountTypeInfoContent } from './AccountTypeInfoContent'
import { RekeyedToRow } from './RekeyedToRow'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'

export type AccountInfoCardProps = {
    account: WalletAccount
    onClose: () => void
    /**
     * When provided, renders an inline "Rekeyed to" section at the bottom of
     * the card showing the auth account. The "Undo Rekey" link is rendered
     * only when `onUndoRekey` is also provided — omit it for accounts whose
     * auth signing material isn't held in the wallet (Rekeyed → No Auth),
     * since they can't actually sign the undo transaction.
     */
    rekeyedTo?: {
        authAccount?: WalletAccount
        authAddress: string
        onUndoRekey?: () => void
    }
}

export const AccountInfoCard = ({
    account,
    onClose,
    rekeyedTo,
}: AccountInfoCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isExpanded,
        handleToggleExpanded,
        accountType,
        minBalanceAlgos,
        isMinBalanceLoading,
        showMinBalance,
        showStructure,
        structureLabel,
        structureIcon,
        structureAccounts,
        structureMainAddress,
        handleScanAddresses,
    } = useAccountInfoCard({ account, onClose })

    const { openInfo: openAccountTypeInfo } = useInfoButton({
        children: <AccountTypeInfoContent account={account} />,
    })

    const { main: typeMain, qualifier: typeQualifier } = accountType

    const renderAccountType = (trailing: ReactNode) => (
        <PWView style={styles.accountTypeBlock}>
            <PWView style={styles.accountTypeMainRow}>
                <PWText
                    variant='h4'
                    style={styles.accountTypeText}
                    truncate
                >
                    {typeMain}
                </PWText>
                {trailing}
            </PWView>
            {typeQualifier && (
                <PWText
                    variant='body'
                    style={styles.accountTypeQualifier}
                >
                    {typeQualifier}
                </PWText>
            )}
        </PWView>
    )

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
            {/* Account type row — same info affordance for all account types */}
            <PWTouchableOpacity
                style={styles.infoRow}
                onPress={openAccountTypeInfo}
                testID='account-type-info-button'
            >
                <PWView style={styles.infoRowValue}>
                    <AccountIcon
                        account={account}
                        size='lg'
                    />
                    {renderAccountType(
                        <PWIcon
                            name='info'
                            size='sm'
                            variant='secondary'
                        />,
                    )}
                </PWView>
            </PWTouchableOpacity>

            {/* Min balance row */}
            {showMinBalance && (
                <PWView style={styles.infoRow}>
                    <PWText
                        variant='footnoteMedium'
                        style={styles.labelText}
                        truncate
                    >
                        {t('account_info.min_balance')}
                    </PWText>
                    <InfoButton
                        title={t('min_balance_info.title')}
                        trigger={
                            <AssetAmount
                                asset={ALGO_ASSET}
                                value={minBalanceAlgos}
                                showSymbol
                                symbolPosition='start'
                                isLoading={isMinBalanceLoading}
                                variant='bodyLarge'
                                weight={500}
                            />
                        }
                    >
                        <PWText style={styles.minBalanceDescription}>
                            {t('min_balance_info.description')}
                        </PWText>
                    </InfoButton>
                </PWView>
            )}

            {rekeyedTo && (
                <>
                    <PWDivider />
                    <RekeyedToRow
                        authAccount={rekeyedTo.authAccount}
                        authAddress={rekeyedTo.authAddress}
                        onUndoRekey={rekeyedTo.onUndoRekey}
                        styles={styles}
                        labelText={t('account_options.rekeyed_to')}
                        undoLabel={t('account_options.undo_rekey')}
                    />
                </>
            )}

            {/* Wallet structure (HD wallets and Ledger devices) */}
            {showStructure && (
                // Wrap ExpandablePanel + toggleSection so the card's `gap`
                // applies once above this block, not above AND below the
                // zero-height panel when collapsed. Divider above the tree
                // lives inside the ExpandablePanel so it collapses with it.
                <PWView>
                    <ExpandablePanel isExpanded={isExpanded}>
                        {rekeyedTo && <PWDivider />}
                        <AccountStructureTree
                            label={structureLabel}
                            icon={structureIcon}
                            accounts={structureAccounts}
                            mainAccountAddress={structureMainAddress}
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
                                truncate
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
                </PWView>
            )}
        </PWView>
    )
}
