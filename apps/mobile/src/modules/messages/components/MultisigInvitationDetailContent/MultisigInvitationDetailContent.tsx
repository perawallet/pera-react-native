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

import { PWButton, PWScrollView, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { MultisigInfoCard } from '@components/MultisigInfoCard'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import type { MultisigInvitationParam } from '../../routes/types'
import { useMultisigInvitationDetailContent } from './useMultisigInvitationDetailContent'
import { useStyles } from './styles'

export type MultisigInvitationDetailContentResult = 'accept' | 'decline'

export type MultisigInvitationDetailContentProps = {
    invitation: MultisigInvitationParam
}

export const MultisigInvitationDetailContent = ({
    invitation,
}: MultisigInvitationDetailContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } =
        useBottomSheetResult<MultisigInvitationDetailContentResult>()

    const {
        renderedInvitation,
        totalParticipants,
        isIgnoring,
        isUserIncluded,
        handleIgnore,
        handleAccept,
    } = useMultisigInvitationDetailContent({
        invitation,
        onIgnored: () => resolve('decline'),
        onAccepted: () => resolve('accept'),
    })

    if (!renderedInvitation) return null

    return (
        <>
            <PWScrollView
                inBottomSheet
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                <PWView style={styles.header}>
                    <PWText
                        variant='h4'
                        style={styles.headerTitle}
                    >
                        {t('multisig.invitation.sheet_title')}
                    </PWText>
                    <PWText
                        style={styles.headerAddress}
                        testID='multisig_invitation_sheet_address'
                    >
                        {truncateAlgorandAddress(renderedInvitation.address)}
                    </PWText>
                </PWView>

                <MultisigInfoCard
                    threshold={renderedInvitation.threshold}
                    totalParticipants={totalParticipants}
                    isUserIncluded={isUserIncluded}
                    participantCountTestID='multisig_invitation_participant_count'
                    thresholdTestID='multisig_invitation_threshold_value'
                />

                <PWText
                    variant='h4'
                    style={styles.sectionHeading}
                >
                    {t('multisig.invitation.accounts_heading', {
                        count: totalParticipants,
                    })}
                </PWText>

                <PWView>
                    {renderedInvitation.participantAddresses.map(
                        (address, index, arr) => (
                            <AddressDisplay
                                // A multisig can list the same address as more
                                // than one participant, so address alone isn't
                                // a unique key.
                                key={`${address}-${index}`}
                                address={address}
                                forceShowIcon
                                contactAvatarVariant='highlighted'
                                textProps={{ variant: 'h4' }}
                                style={[
                                    styles.participantRow,
                                    index === arr.length - 1 &&
                                        styles.participantRowLast,
                                ]}
                                testID={`participant_row_${address}_${index}`}
                            />
                        ),
                    )}
                </PWView>
            </PWScrollView>

            <PWView style={styles.bottomBar}>
                <PWButton
                    variant='secondary'
                    title={t('multisig.invitation.ignore')}
                    onPress={handleIgnore}
                    isLoading={isIgnoring}
                    isDisabled={isIgnoring}
                    paddingStyle='dense'
                    style={styles.ignoreButton}
                    testID='multisig_invitation_ignore_button'
                />
                <PWButton
                    variant='primary'
                    title={t('multisig.invitation.add_to_accounts')}
                    onPress={handleAccept}
                    isDisabled={isIgnoring}
                    paddingStyle='dense'
                    style={styles.acceptButton}
                    testID='multisig_invitation_accept_button'
                />
            </PWView>
        </>
    )
}
