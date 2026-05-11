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

type InvitationInfoCardProps = {
    threshold: number
    totalParticipants: number
    isUserIncluded: boolean
}

export const InvitationInfoCard = ({
    threshold,
    totalParticipants,
    isUserIncluded,
}: InvitationInfoCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.row}>
                <PWView style={styles.rowLabels}>
                    <PWText variant='h4'>
                        {t('multisig.invitation.number_of_accounts_label')}
                    </PWText>
                    {isUserIncluded && (
                        <PWText style={styles.rowSubLabel}>
                            {t('multisig.invitation.you_included')}
                        </PWText>
                    )}
                </PWView>
                <ParticipantCount
                    count={totalParticipants}
                    testID='multisig_invitation_participant_count'
                />
            </PWView>
            <PWView style={styles.row}>
                <PWView style={styles.rowLabels}>
                    <PWText variant='h4'>
                        {t('multisig.invitation.threshold_label')}
                    </PWText>
                    <PWText style={styles.rowSubLabel}>
                        {t('multisig.invitation.threshold_description')}
                    </PWText>
                </PWView>
                <PWText
                    variant='h2'
                    testID='multisig_invitation_threshold_value'
                >
                    {threshold}
                </PWText>
            </PWView>
        </PWView>
    )
}
