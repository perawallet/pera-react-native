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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type CardFundingAccountSectionProps = {
    /** Connected funding-source address; the row offers Connect only when absent. */
    address: string | null
    /** Fires from the Connect affordance; unreachable once an address is set. */
    onChange: () => void
    /** Funding TYPE only applies once a card exists — hides that row until then. */
    hasCard: boolean
    /** Localised Auto/Manual funding label. */
    fundingTypeLabel: string
    onChangeFundingType: () => void
}

/** Grouped "Funding" selectors: the linked account and the funding type. */
export const CardFundingAccountSection = ({
    address,
    onChange,
    hasCard,
    fundingTypeLabel,
    onChangeFundingType,
}: CardFundingAccountSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.fundingGroup}>
            <PWView
                style={styles.fundingGroupRow}
                testID='pera_card_funding_account_row'
            >
                <PWView style={styles.fundingGroupValue}>
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.fundingGroupLabel}
                    >
                        {t('peraCard.account.funding_account')}
                    </PWText>
                    {address != null ? (
                        <AddressDisplay
                            address={address}
                            addressFormat='short'
                            showCopy={false}
                            hugContent
                        />
                    ) : (
                        <PWText
                            variant='body'
                            weight={500}
                        >
                            {t('peraCard.account.no_funding_account')}
                        </PWText>
                    )}
                </PWView>
                {/* TODO(card): re-linking an already-connected funding account
                    has no robust implementation yet, so only the first-time
                    Connect is offered. Restore the Change link here once it
                    does. */}
                {address == null && (
                    <PWTouchableOpacity
                        onPress={onChange}
                        hitSlop={8}
                        testID='pera_card_change_funding_button'
                    >
                        <PWText
                            variant='body'
                            weight={500}
                            style={styles.changeLink}
                        >
                            {t('peraCard.account.connect')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </PWView>

            {hasCard && (
                <>
                    <PWView style={styles.fundingGroupDivider} />

                    <PWView
                        style={styles.fundingGroupRow}
                        testID='pera_card_funding_type_row'
                    >
                        <PWView style={styles.fundingGroupValue}>
                            <PWText
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.fundingGroupLabel}
                            >
                                {t('peraCard.account.funding_type_label')}
                            </PWText>
                            <PWText
                                variant='body'
                                weight={500}
                            >
                                {fundingTypeLabel}
                            </PWText>
                        </PWView>
                        <PWTouchableOpacity
                            onPress={onChangeFundingType}
                            hitSlop={8}
                            testID='pera_card_change_funding_type_button'
                        >
                            <PWText
                                variant='body'
                                weight={500}
                                style={styles.changeLink}
                            >
                                {t('peraCard.account.change')}
                            </PWText>
                        </PWTouchableOpacity>
                    </PWView>
                </>
            )}
        </PWView>
    )
}
