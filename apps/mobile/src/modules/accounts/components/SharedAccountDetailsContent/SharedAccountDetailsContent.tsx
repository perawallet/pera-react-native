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
    PWSheetLayout,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { MultisigInfoCard } from '@components/MultisigInfoCard'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { SheetHeader } from '@modules/bottom-sheet'
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
    const { isUserIncluded, isAddressInWallet, handleEditContact } =
        useSharedAccountDetailsContent(details.addresses)

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={
                        details.name || truncateAlgorandAddress(details.address)
                    }
                    titleVariant='bodyLarge'
                    subtitle={
                        details.name
                            ? truncateAlgorandAddress(details.address)
                            : undefined
                    }
                />
            }
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
                            (participantAddress, index, arr) => {
                                const inWallet =
                                    isAddressInWallet(participantAddress)
                                const isLast = index === arr.length - 1
                                return (
                                    <AddressDisplay
                                        // A multisig can repeat a participant
                                        // address, so address alone isn't unique.
                                        key={`${participantAddress}-${index}`}
                                        address={participantAddress}
                                        forceShowIcon
                                        contactAvatarVariant='highlighted'
                                        textProps={{ variant: 'h4' }}
                                        style={[
                                            styles.participant,
                                            isLast && styles.participantLast,
                                        ]}
                                        testID={`shared_account_participant_${participantAddress}_${index}`}
                                        trailing={
                                            inWallet ? undefined : (
                                                <PWTouchableIcon
                                                    name='edit-pen'
                                                    size='md'
                                                    variant='positive'
                                                    onPress={() =>
                                                        handleEditContact(
                                                            participantAddress,
                                                        )
                                                    }
                                                    testID={`shared_account_participant_edit_${participantAddress}_${index}`}
                                                />
                                            )
                                        }
                                    />
                                )
                            },
                        )}
                    </PWView>
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
