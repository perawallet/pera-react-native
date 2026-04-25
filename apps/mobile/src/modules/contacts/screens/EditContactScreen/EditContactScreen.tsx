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

import { useCallback } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native'

import { PWButton, PWView } from '@components/core'
import { ConfirmActionBottomSheet } from '@components/ConfirmActionBottomSheet'
import { ContactForm } from '@components/ContactForm'
import { PhotoPermissionDeniedSheet } from '@components/PhotoPermissionDeniedSheet'
import {
    Contact,
    ContactNotFoundError,
    DuplicateAddressError,
    useContacts,
    contactSchema,
} from '@perawallet/wallet-core-contacts'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { useStyles } from './styles'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useEditContactForm } from '@modules/contacts/hooks'
import { useStyles } from './styles'

export const EditContactScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        addContact,
        editContact,
        deleteContact,
        selectedContact,
        setSelectedContact,
    } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { theme } = useTheme()
    const { isOpen, open, close } = useModalState()
    const isEditMode = !!selectedContact

    const {
        selectedContact,
        control,
        handleSubmit,
        errors,
        isValid,
        rawAddressInput,
        imageUri,
        nfd,
        confirmDelete,
        onAddressInputChange,
        onPickImage,
        permissionDenied,
        save,
        removeContact,
    } = useEditContactForm()

    useNavigationHeader({
        enabled: true,
        right: (
            <PWButton
                variant='link'
                title={t('contacts.edit_contact.done')}
                onPress={handleSubmit(save)}
                isDisabled={!isValid}
                paddingStyle='none'
            />
        ),
    })
    useEffect(() => {
        if (isNfdResolved) {
            setValue('address', resolvedAddress, { shouldValidate: true })
        }
    }, [isNfdResolved, resolvedAddress, setValue])

    const handleAddressInputChange = useCallback(
        (text: string) => {
            setRawAddressInput(text)
            setValue('address', text, { shouldValidate: true })
        },
        [setValue],
    )

    const save = (data: Contact) => {
        if (!isValid) return

        try {
            if (isEditMode && selectedContact) {
                editContact(selectedContact.address, data)
            } else {
                addContact(data)
            }
        } catch (e) {
            if (e instanceof DuplicateAddressError) {
                setError('address', {
                    message: 'Contact for this address already exists.',
                })
                return
            }
            if (e instanceof ContactNotFoundError) {
                // The selected contact was removed before save landed
                // (e.g. on another device). Drop the stale selection
                // and pop back without reporting a false success.
                setSelectedContact(null)
                navigation.goBack()
                return
            }
            throw e
        }

        setSelectedContact(null)
        navigation.goBack()
    }

    const openDeleteConfirm = useCallback(() => {
        Keyboard.dismiss()
        confirmDelete.open()
    }, [confirmDelete])

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ContactForm
                control={control}
                address={
                    nfd.isNfdResolved
                        ? nfd.resolvedAddress
                        : (selectedContact?.address ?? '')
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
                onPickImage={onPickImage}
            >
                <PWView style={styles.deletePillWrapper}>
                    <PWButton
                        onPress={openDeleteConfirm}
                        title={t('contacts.edit_contact.delete_this')}
                        variant='destructive'
                        style={styles.deletePill}
                        rounded
                    />
                </PWView>
            </ContactForm>
            <ConfirmActionBottomSheet
                isVisible={confirmDelete.isOpen}
                onClose={confirmDelete.close}
                onConfirm={removeContact}
                icon='trash'
                iconVariant='error'
                title={t('contacts.edit_contact.remove_title')}
                message={t('contacts.edit_contact.remove_message')}
                confirmLabel={t('contacts.edit_contact.remove_confirm')}
                cancelLabel={t('contacts.edit_contact.remove_cancel')}
            />
            <PhotoPermissionDeniedSheet
                isVisible={permissionDenied.isVisible}
                onClose={permissionDenied.close}
                onOpenSettings={permissionDenied.openSettings}
            />
        </KeyboardAvoidingView>
    )
}
