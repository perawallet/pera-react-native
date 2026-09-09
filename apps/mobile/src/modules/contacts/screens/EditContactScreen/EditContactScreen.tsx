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

import { useCallback } from 'react'
import { Keyboard } from 'react-native'

import { PWButton, PWScreen } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { ContactForm } from '@components/ContactForm'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useBottomSheet } from '@modules/bottom-sheet'
import { DeleteFromBackupSheet } from '@modules/cloud-backup'
import { useEditContactForm } from '@modules/contacts/hooks'

export const EditContactScreen = () => {
    const { t } = useLanguage()
    const {
        contact,
        control,
        handleSubmit,
        errors,
        isValid,
        rawAddressInput,
        imageUri,
        nfd,
        needsBackupChoice,
        onAddressInputChange,
        onPickImage,
        save,
        removeContact,
    } = useEditContactForm()
    const { request: requestBottomSheet } = useBottomSheet()

    useNavigationHeader({
        enabled: true,
        right: (
            <PWButton
                variant='linkPositive'
                title={t('contacts.edit_contact.done')}
                onPress={() => void handleSubmit(save)()}
                isDisabled={!isValid}
                paddingStyle='none'
                testID='edit_contact_done_button'
            />
        ),
    })

    const openDeleteConfirm = useCallback(async () => {
        // Presenting a sheet isn't a nav blur, so dismiss the keyboard ourselves.
        Keyboard.dismiss()
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='trash'
                    iconVariant='error'
                    title={t('contacts.edit_contact.remove_title')}
                    message={t('contacts.edit_contact.remove_message')}
                    confirmLabel={t('contacts.edit_contact.remove_confirm')}
                    cancelLabel={t('contacts.edit_contact.remove_cancel')}
                    confirmTestID='contact_delete_confirm_button'
                    cancelTestID='contact_delete_cancel_button'
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!confirmed) return
        if (!needsBackupChoice) {
            await removeContact()
            return
        }

        const shouldDelete = await requestBottomSheet<boolean>({
            contents: (
                <DeleteFromBackupSheet
                    title={t('cloud_backup.contacts.delete_sheet_title')}
                    message={t('cloud_backup.contacts.delete_sheet_body')}
                    declineLabel={t('cloud_backup.accounts.keep_action')}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        // Dismissed without choosing: the contact stays, so the user is never
        // left with a removal whose cloud half they did not decide.
        if (shouldDelete == null) return
        await removeContact(shouldDelete ? 'delete' : 'keep')
    }, [requestBottomSheet, t, removeContact, needsBackupChoice])

    return (
        <PWScreen
            footer={
                <PWButton
                    onPress={() => void openDeleteConfirm()}
                    title={t('contacts.edit_contact.delete_this')}
                    variant='destructive'
                    testID='edit_contact_delete_button'
                />
            }
        >
            <ContactForm
                control={control}
                address={
                    nfd.isNfdResolved
                        ? nfd.resolvedAddress
                        : (contact?.address ?? '')
                }
                nameLabel={t('contacts.edit_contact.name_label')}
                addressLabel={t('contacts.edit_contact.address_label')}
                nameError={errors.name?.message}
                addressError={errors.address?.message}
                nfdName={nfd.isNfdResolved ? nfd.nfdName : undefined}
                isResolvingNfd={nfd.isNfdResolving}
                onAddressInputChange={onAddressInputChange}
                rawAddressInput={rawAddressInput}
                imageUri={imageUri}
                onPickImage={() => void onPickImage()}
            />
        </PWScreen>
    )
}
