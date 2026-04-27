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

import {
    IconName,
    PWBottomSheet,
    PWButton,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MultisigInvitationParam } from '../../routes/types'
import { InvitationInfoCard } from './components/InvitationInfoCard'
import { useMultisigInvitationDetailBottomSheet } from './useMultisigInvitationDetailBottomSheet'
import { useStyles } from './styles'

type MultisigInvitationDetailBottomSheetProps = {
    invitation: MultisigInvitationParam | null
    onClose: () => void
}

export const MultisigInvitationDetailBottomSheet = ({
    invitation,
    onClose,
}: MultisigInvitationDetailBottomSheetProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()

    const participantIconName: IconName = isDarkMode
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    const {
        renderedInvitation,
        totalParticipants,
        isIgnoring,
        isUserIncluded,
        handleIgnore,
        handleAccept,
    } = useMultisigInvitationDetailBottomSheet({
        invitation,
        onClose,
    })

    if (!renderedInvitation) return null

    return (
        <PWBottomSheet
            isVisible={invitation !== null}
            onBackdropPress={onClose}
            size='lg'
            enablePanDownToClose
            autoCreateContainer={false}
            testID='multisig_invitation_detail_bottom_sheet'
        >
            <PWScrollView
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

                <InvitationInfoCard
                    threshold={renderedInvitation.threshold}
                    totalParticipants={totalParticipants}
                    isUserIncluded={isUserIncluded}
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
                                key={address}
                                address={address}
                                addressFormat='medium'
                                iconName={participantIconName}
                                showSecondaryAddress
                                style={[
                                    styles.participantRow,
                                    index === arr.length - 1 &&
                                        styles.participantRowLast,
                                ]}
                                testID={`participant_row_${address}`}
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
                    style={styles.bottomButton}
                    testID='multisig_invitation_ignore_button'
                />
                <PWButton
                    variant='primary'
                    title={t('multisig.invitation.add_to_accounts')}
                    onPress={handleAccept}
                    isDisabled={isIgnoring}
                    paddingStyle='dense'
                    style={styles.bottomButton}
                    testID='multisig_invitation_accept_button'
                />
            </PWView>
        </PWBottomSheet>
    )
}
