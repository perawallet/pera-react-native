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

import { PWText, PWView } from '@components/core'
import { ParticipantCount } from '@components/ParticipantCount'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type MultisigInfoCardProps = {
    totalParticipants: number
    threshold: number
    isUserIncluded: boolean
    /**
     * Whether the wallet holds a participant that can actually sign for this
     * shared account. Defaults to `true` so call sites that don't compute
     * signability render no warning; when `false`, a cannot-sign warning is
     * shown.
     */
    canUserSign?: boolean
    testID?: string
    participantCountTestID?: string
    thresholdTestID?: string
}

/**
 * Filled card summarising a shared (multisig) account: the participant count
 * and the signing threshold. Shared across the shared-account detail sheet,
 * the import screen and the invitation sheet.
 */
export const MultisigInfoCard = ({
    totalParticipants,
    threshold,
    isUserIncluded,
    canUserSign = true,
    testID,
    participantCountTestID,
    thresholdTestID,
}: MultisigInfoCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.row}>
                <PWView style={styles.rowLabels}>
                    <PWText variant='h4'>
                        {t('multisig.info_card.number_of_accounts')}
                    </PWText>
                    {isUserIncluded && (
                        <PWText style={styles.rowSubLabel}>
                            {t('multisig.info_card.you_included')}
                        </PWText>
                    )}
                    {!canUserSign && (
                        <PWText
                            style={styles.rowWarningLabel}
                            testID='multisig-info-card-cannot-sign-warning'
                        >
                            {t('multisig.info_card.cannot_sign_warning')}
                        </PWText>
                    )}
                </PWView>
                <ParticipantCount
                    count={totalParticipants}
                    testID={participantCountTestID}
                />
            </PWView>
            <PWView style={styles.row}>
                <PWView style={styles.rowLabels}>
                    <PWText variant='h4'>
                        {t('multisig.info_card.threshold')}
                    </PWText>
                    <PWText style={styles.rowSubLabel}>
                        {t('multisig.info_card.threshold_description')}
                    </PWText>
                </PWView>
                <PWText
                    variant='h2'
                    testID={thresholdTestID}
                >
                    {threshold}
                </PWText>
            </PWView>
        </PWView>
    )
}
