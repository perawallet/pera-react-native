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

import { useTheme } from '@rneui/themed'
import { PWDivider, PWText, PWView } from '@components/core'
import AppleWalletIcon from '@assets/icons/apple-wallet.svg'
import GooglePayIcon from '@assets/icons/google-pay.svg'
import { useLanguage } from '@hooks/useLanguage'
import { type WalletPlatform } from '../WalletInstructionsSheet'
import { CardOptionRow } from './CardOptionRow'
import { useStyles } from './styles'

type CardOptionsSectionProps = {
    isFrozen: boolean
    freezeLabel: string
    isFreezing: boolean
    /** Hides the freeze row when the card can't be (un)frozen (e.g. BLOCKED). */
    canToggleFreeze: boolean
    /** iOS shows Apple Wallet, Android shows Google Pay — only one provisioning row. */
    walletPlatform: WalletPlatform
    isSettingPin: boolean
    /** Disables the set-PIN and freeze rows (offline-unsafe); report rows stay
     * active since they're pure navigation. */
    isOffline?: boolean
    /** Hides every card-only row (wallet provisioning, PIN, freeze, reports)
     * until the Baanx card exists; only Accounts Details (user-profile data)
     * survives without one. */
    showCardActions: boolean
    onAccountsDetails: () => void
    onAddToWallet: () => void
    onSetPin: () => void
    onToggleFreeze: () => void
    onReportLostStolen: () => void
    onReportSuspicious: () => void
}

export const CardOptionsSection = ({
    isFrozen,
    freezeLabel,
    isFreezing,
    canToggleFreeze,
    walletPlatform,
    isSettingPin,
    isOffline = false,
    showCardActions,
    onAccountsDetails,
    onAddToWallet,
    onSetPin,
    onToggleFreeze,
    onReportLostStolen,
    onReportSuspicious,
}: CardOptionsSectionProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    return (
        <PWView style={styles.section}>
            <PWText
                variant='body'
                style={styles.sectionLabel}
            >
                {t('peraCard.account.options')}
            </PWText>

            <PWView style={styles.optionsList}>
                <CardOptionRow
                    icon='person'
                    label={t('peraCard.account.accounts_details')}
                    onPress={onAccountsDetails}
                    testID='pera_card_accounts_details_row'
                />

                {showCardActions ? (
                    <>
                        <PWDivider />

                        {walletPlatform === 'apple' ? (
                            <CardOptionRow
                                iconElement={
                                    <AppleWalletIcon
                                        width={theme.spacing.xl}
                                        height={theme.spacing.xl}
                                        color={theme.colors.textMain}
                                    />
                                }
                                label={t(
                                    'peraCard.account.add_to_apple_wallet',
                                )}
                                onPress={onAddToWallet}
                                testID='pera_card_apple_wallet_row'
                            />
                        ) : (
                            <CardOptionRow
                                iconElement={
                                    <GooglePayIcon
                                        width={theme.spacing.xl}
                                        height={theme.spacing.xl}
                                    />
                                }
                                label={t('peraCard.account.add_to_google_pay')}
                                onPress={onAddToWallet}
                                testID='pera_card_google_pay_row'
                            />
                        )}

                        <PWDivider />

                        <CardOptionRow
                            icon='locked'
                            label={t('peraCard.account.set_pin')}
                            onPress={onSetPin}
                            isLoading={isSettingPin}
                            isDisabled={isOffline}
                            testID='pera_card_set_pin_row'
                        />
                        {canToggleFreeze ? (
                            <CardOptionRow
                                icon={isFrozen ? 'play' : 'pause'}
                                label={freezeLabel}
                                onPress={onToggleFreeze}
                                isLoading={isFreezing}
                                isDisabled={isOffline}
                                testID='pera_card_freeze_row'
                            />
                        ) : null}
                        <CardOptionRow
                            icon='shield-warning'
                            label={t('peraCard.account.report_lost_stolen')}
                            onPress={onReportLostStolen}
                            testID='pera_card_report_lost_row'
                        />
                        <CardOptionRow
                            icon='flag'
                            label={t('peraCard.account.report_suspicious')}
                            onPress={onReportSuspicious}
                            testID='pera_card_report_suspicious_row'
                        />
                    </>
                ) : null}
            </PWView>
        </PWView>
    )
}
