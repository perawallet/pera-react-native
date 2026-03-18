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

import { PWButton } from '@components/core'
import { ContactForm } from '@components/ContactForm'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useEditParticipantScreen } from './useEditParticipantScreen'
import { useStyles } from './styles'

export const EditParticipantScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { address, control, isDoneDisabled, handleDone, handleRemove } =
        useEditParticipantScreen()

    useNavigationHeader({
        title: t('multisig.edit_participant.title'),
        right: (
            <PWButton
                variant='link'
                title={t('multisig.edit_participant.done')}
                onPress={handleDone}
                isDisabled={isDoneDisabled}
                paddingStyle='none'
            />
        ),
    })

    return (
        <ContactForm
            control={control}
            address={address}
            nameLabel={t('multisig.edit_participant.nickname_label')}
            namePlaceholder={t(
                'multisig.edit_participant.nickname_placeholder',
            )}
            addressLabel={t('multisig.edit_participant.address_label')}
        >
            <PWButton
                variant='destructiveLight'
                title={t('multisig.edit_participant.remove')}
                onPress={handleRemove}
                style={styles.removeButton}
            />
        </ContactForm>
    )
}
