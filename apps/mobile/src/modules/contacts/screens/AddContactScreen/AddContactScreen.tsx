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

import { PWButton, PWScreen } from '@components/core'
import { ContactForm } from '@components/ContactForm'
import { useLanguage } from '@hooks/useLanguage'
import { ContactAddressFields } from '@modules/contacts/components/ContactAddressFields'
import { useAddContactForm } from '@modules/contacts/hooks'
import { useStyles } from './styles'

export const AddContactScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        control,
        handleSubmit,
        errors,
        isValid,
        addressRows,
        isAddressInputVisible,
        rawAddressInput,
        isAddressInputInvalid,
        pendingReplacement,
        imageUri,
        nfd,
        showAddressInput,
        onAddressInputChange,
        confirmReplacement,
        cancelReplacement,
        removeAddress,
        onPickImage,
        save,
    } = useAddContactForm()

    return (
        <PWScreen
            footer={
                <PWButton
                    onPress={() => void handleSubmit(save)()}
                    title={t('contacts.edit_contact.add_contact')}
                    variant='primary'
                    isDisabled={!isValid}
                    style={styles.footerButton}
                    testID='add_contact_button'
                />
            }
        >
            <ContactForm
                control={control}
                nameLabel={t('contacts.edit_contact.name_label')}
                nameError={errors.name?.message}
                addressSection={
                    <ContactAddressFields
                        rows={addressRows}
                        isInputVisible={isAddressInputVisible}
                        rawInput={rawAddressInput}
                        isInputInvalid={isAddressInputInvalid}
                        isResolvingNfd={nfd.isNfdResolving}
                        pendingReplacement={pendingReplacement}
                        onShowInput={showAddressInput}
                        onInputChange={onAddressInputChange}
                        onConfirmReplacement={confirmReplacement}
                        onCancelReplacement={cancelReplacement}
                        onRemove={removeAddress}
                    />
                }
                imageUri={imageUri}
                onPickImage={() => void onPickImage()}
            />
        </PWScreen>
    )
}
