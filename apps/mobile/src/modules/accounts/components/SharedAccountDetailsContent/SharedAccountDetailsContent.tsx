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
import { PWText, PWToolbar, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { MultisigInfoCard } from '@components/MultisigInfoCard'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useSharedAccountDetailsContent } from './useSharedAccountDetailsContent'
import { useStyles } from './styles'

export type SharedAccountDetails = {
    name: string
    address: string
    participantCount: number
    threshold: number
    addresses: string[]
}

export type SharedAccountDetailsContentProps = {
    details: SharedAccountDetails
}

export const SharedAccountDetailsContent = ({
    details,
}: SharedAccountDetailsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isUserIncluded } = useSharedAccountDetailsContent(details.addresses)

    return (
        <>
            <PWToolbar
                center={
                    <PWView style={styles.headerTitle}>
                        {!!details.name && (
                            <PWText variant='h4'>{details.name}</PWText>
                        )}
                        <PWText style={styles.headerAddress}>
                            {truncateAlgorandAddress(details.address)}
                        </PWText>
                    </PWView>
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
                    <MultisigInfoCard
                        totalParticipants={details.participantCount}
                        threshold={details.threshold}
                        isUserIncluded={isUserIncluded}
                        participantCountTestID='shared_account_participant_count'
                        thresholdTestID='shared_account_threshold'
                    />

                    <PWView style={styles.participants}>
                        <PWText variant='h4'>
                            {t('multisig.detail.accounts_title', {
                                count: details.participantCount,
                            })}
                        </PWText>
                        <PWView>
                            {details.addresses.map(
                                (participantAddress, index, arr) => (
                                    <AddressDisplay
                                        key={participantAddress}
                                        address={participantAddress}
                                        forceShowIcon
                                        textProps={{ variant: 'h4' }}
                                        style={[
                                            styles.participant,
                                            index === arr.length - 1 &&
                                                styles.participantLast,
                                        ]}
                                        testID={`shared_account_participant_${participantAddress}`}
                                    />
                                ),
                            )}
                        </PWView>
                    </PWView>
                </PWView>
            </BottomSheetScrollView>
        </>
    )
}
