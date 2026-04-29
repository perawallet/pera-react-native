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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ParticipantListItem } from '../../components/ParticipantListItem'
import { AddParticipantBottomSheet } from '../../components/AddParticipantBottomSheet'
import { useCreateMultisigScreen } from './useCreateMultisigScreen'
import { useStyles } from './styles'

export const CreateMultisigScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        participants,
        isAddParticipantVisible,
        canContinue,
        handleOpenAddParticipant,
        handleCloseAddParticipant,
        handleAddAddress,
        handleEditParticipant,
        handleContinue,
    } = useCreateMultisigScreen()

    return (
        <>
            <PWView style={styles.container}>
                <PWView style={styles.content}>
                    <PWView style={styles.headerContainer}>
                        <PWText variant='h1'>
                            {t('multisig.create.title')}
                        </PWText>
                        <PWText style={styles.description}>
                            {t('multisig.create.description')}
                        </PWText>
                    </PWView>

                    <PWText variant='h4'>
                        {t('multisig.create.accounts_section')}
                    </PWText>
                    <PWText style={styles.description}>
                        {t('multisig.create.accounts_subtitle')}
                    </PWText>

                    <PWView style={styles.spacer}>
                        {participants.map(participant => (
                            <ParticipantListItem
                                key={participant.address}
                                participant={participant}
                                onEdit={handleEditParticipant}
                            />
                        ))}
                        <PWButton
                            variant='linkPositive'
                            icon='plus'
                            title={t('multisig.create.add_account')}
                            onPress={handleOpenAddParticipant}
                            testID='add_participant_button'
                            paddingStyle='none'
                            style={styles.addButton}
                        />
                    </PWView>

                    <PWButton
                        variant='primary'
                        title={t('common.continue.label')}
                        onPress={handleContinue}
                        isDisabled={!canContinue}
                        style={styles.continueButton}
                        testID='create_multisig_continue_button'
                    />
                </PWView>
            </PWView>

            <AddParticipantBottomSheet
                isVisible={isAddParticipantVisible}
                onClose={handleCloseAddParticipant}
                onAddAddress={handleAddAddress}
            />
        </>
    )
}
