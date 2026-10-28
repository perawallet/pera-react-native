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
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { StatusChecklistRow } from './StatusChecklistRow'
import { useStyles } from './styles'

type EnterDetailsRowProps = {
    areDetailsSubmitted: boolean
    onEnterDetails: () => void
}

export const EnterDetailsRow = ({
    areDetailsSubmitted,
    onEnterDetails,
}: EnterDetailsRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <StatusChecklistRow
            icon={areDetailsSubmitted ? 'check' : 'person'}
            iconVariant={areDetailsSubmitted ? 'positive' : 'primary'}
            title={t('peraCard.setup_status.details_title')}
            body={
                areDetailsSubmitted
                    ? undefined
                    : t('peraCard.setup_status.details_body')
            }
            testID='card-onboarding-status-details'
        >
            {areDetailsSubmitted ? null : (
                <PWButton
                    variant='primary'
                    title={t('peraCard.setup_status.details_button')}
                    onPress={onEnterDetails}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-details-cta'
                />
            )}
        </StatusChecklistRow>
    )
}
