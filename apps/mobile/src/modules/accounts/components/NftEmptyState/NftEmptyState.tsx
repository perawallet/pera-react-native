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
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import NftEmptyIllustration from '@assets/images/nft-empty-state.svg'

type NftEmptyStateProps = {
    /**
     * Hides the opt-in CTA when omitted. Watch / NoAuth accounts can't
     * sign opt-in transactions, so the button would be a dead-end.
     */
    onOptInPress?: () => void
}

export const NftEmptyState = ({ onOptInPress }: NftEmptyStateProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.illustrationContainer}>
                <NftEmptyIllustration
                    width={192}
                    height={192}
                />
            </PWView>
            <PWText
                variant='h2'
                style={styles.title}
            >
                {t('account_details.nfts.empty_title')}
            </PWText>
            <PWText style={styles.body}>
                {t('account_details.nfts.empty_body')}
            </PWText>
            {onOptInPress && (
                <PWButton
                    title={t('account_details.nfts.empty_optin')}
                    icon='plus'
                    variant='primary'
                    style={styles.button}
                    onPress={onOptInPress}
                />
            )}
        </PWView>
    )
}
