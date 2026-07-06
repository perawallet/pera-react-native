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
import { AUTO_FUNDING_PER_TX_LIMIT_USD } from '@perawallet/wallet-core-card'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

/** Explainer body for the "Select Funding Type" info sheet — Auto vs Manual. */
export const FundingTypeInfoContent = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.infoContent}>
            <PWView style={styles.infoSection}>
                <PWText
                    variant='body'
                    weight={500}
                >
                    {t('peraCard.setup_status.funding_type_auto_title')}
                </PWText>
                <PWText
                    variant='body'
                    weight={400}
                    style={styles.infoText}
                >
                    {t('peraCard.setup_status.funding_type_auto_info')}
                </PWText>
                <PWText
                    variant='body'
                    weight={400}
                    style={styles.infoText}
                >
                    {t('peraCard.setup_status.funding_type_limit_info', {
                        limit: formatCurrency(
                            AUTO_FUNDING_PER_TX_LIMIT_USD,
                            0,
                            'USD',
                        ),
                    })}
                </PWText>
            </PWView>
            <PWView style={styles.infoSection}>
                <PWText
                    variant='body'
                    weight={500}
                >
                    {t('peraCard.setup_status.funding_type_manual_title')}
                </PWText>
                <PWText
                    variant='body'
                    weight={400}
                    style={styles.infoText}
                >
                    {t('peraCard.setup_status.funding_type_manual_info')}
                </PWText>
            </PWView>
        </PWView>
    )
}
