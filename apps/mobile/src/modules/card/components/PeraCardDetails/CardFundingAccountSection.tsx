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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type CardFundingAccountSectionProps = {
    /** Connected funding-source address; the section is hidden when absent. */
    address: string | null
    onChange: () => void
}

export const CardFundingAccountSection = ({
    address,
    onChange,
}: CardFundingAccountSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    if (address == null) return null

    return (
        <PWView style={styles.section}>
            <PWText
                variant='body'
                style={styles.sectionLabel}
            >
                {t('peraCard.account.funding_account')}
            </PWText>

            <PWView style={styles.fundingRow}>
                <AddressDisplay
                    address={address}
                    addressFormat='short'
                    showCopy={false}
                    hugContent
                />
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
                        {t('peraCard.account.change')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>
        </PWView>
    )
}
