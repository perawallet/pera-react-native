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

import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { PWDivider, PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ParticipantCount } from '@components/ParticipantCount'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import type { SharedAccountDetails } from '../useAccountInfoCard'
import { useStyles } from './styles'

export type SharedAccountDetailsContentProps = {
    details: SharedAccountDetails
}

export const SharedAccountDetailsContent = ({
    details,
}: SharedAccountDetailsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <>
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={dismiss}
                    />
                }
                center={
                    <PWText variant='h3'>{t('multisig.detail.title')}</PWText>
                }
                paddingStyle='dense'
            />
            <BottomSheetScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <PWView
                    style={styles.details}
                    testID='shared_account_details_content'
                >
                    <PWView
                        style={styles.summaryRow}
                        testID='shared_account_participant_count_row'
                    >
                        <PWText
                            variant='body'
                            style={styles.labelText}
                        >
                            {t('multisig.detail.number_of_accounts')}
                        </PWText>
                        <PWView style={styles.summaryValue}>
                            <ParticipantCount
                                count={details.participantCount}
                                size='h2'
                                testID='shared_account_participant_count'
                            />
                        </PWView>
                    </PWView>

                    <PWView
                        style={styles.summaryRow}
                        testID='shared_account_threshold_row'
                    >
                        <PWText
                            variant='body'
                            style={styles.labelText}
                        >
                            {t('multisig.detail.threshold')}
                        </PWText>
                        <PWView style={styles.summaryValue}>
                            <PWText
                                variant='h2'
                                testID='shared_account_threshold'
                            >
                                {details.threshold}
                            </PWText>
                        </PWView>
                    </PWView>

                    <PWDivider />

                    <PWView style={styles.participants}>
                        <PWText variant='h4'>
                            {t('multisig.detail.accounts_title', {
                                count: details.participantCount,
                            })}
                        </PWText>
                        {details.addresses.map(address => (
                            <AddressDisplay
                                key={address}
                                address={address}
                                forceShowIcon
                                textProps={{ variant: 'h4' }}
                                style={styles.participant}
                                testID={`shared_account_participant_${address}`}
                            />
                        ))}
                    </PWView>
                </PWView>
            </BottomSheetScrollView>
        </>
    )
}
