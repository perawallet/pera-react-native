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

import { useCallback, useMemo } from 'react'
import {
    useNavigation,
    useRoute,
    type ParamListBase,
    type RouteProp,
} from '@react-navigation/native'
import {
    ContactNotFoundError,
    DuplicateAddressError,
    useContacts,
    type Contact,
} from '@perawallet/wallet-core-contacts'

import { getBackupSyncManager } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'
import { useIsContactBackedUp } from '@modules/cloud-backup'
import { trackEvent, ContactsEvent } from '@analytics'
import { useContactForm, type UseContactFormResult } from './useContactForm'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ContactsStackParamsList } from '@modules/contacts/routes'

export type ContactBackupChoice = 'delete' | 'keep'

export type UseEditContactFormResult = UseContactFormResult & {
    /**
     * The contact being edited: the deeplink target when the screen was reached
     * via QR/deeplink, otherwise the in-app store selection. Deliberately not
     * named `selectedContact` — it is no longer always the store's selection.
     */
    contact: Contact | null
    /** True when removing this contact needs the cloud-backup choice first. */
    needsBackupChoice: boolean
    save: (data: Contact) => void
    removeContact: (backupChoice?: ContactBackupChoice) => Promise<void>
}

export const useEditContactForm = (): UseEditContactFormResult => {
    const {
        editContact,
        deleteContact,
        contacts,
        selectedContact,
        setSelectedContact,
    } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()

    // EDIT_CONTACT deeplinks / QR carry the target address+label in route
    // params. When present, the contact to edit is the one that address
    // identifies — resolve it from the store (falling back to the link's own
    // values when it isn't a saved contact yet, e.g. after a force-quit before
    // the store rehydrates), NOT whatever was previously selected in-app.
    // Without this a QR "for B" would prefill, edit, and delete the stale
    // in-app selection A. In-app (no params) keeps using the store selection.
    const route = useRoute<RouteProp<ContactsStackParamsList, 'EditContact'>>()
    const routeAddress = route.params?.address
    const routeLabel = route.params?.label
    const targetContact = useMemo<Contact | null>(() => {
        if (!routeAddress) return selectedContact
        return (
            contacts.find(contact => contact.address === routeAddress) ?? {
                address: routeAddress,
                name: routeLabel ?? '',
            }
        )
    }, [routeAddress, routeLabel, contacts, selectedContact])

    const form = useContactForm(targetContact)

    const { showToast } = useToast()
    const isCloudBackupEnabled = useIsCloudBackupEnabled()
    const isBackedUp = useIsContactBackedUp(targetContact?.address ?? '')
    const needsBackupChoice = isCloudBackupEnabled && isBackedUp

    const save = useCallback(
        (data: Contact) => {
            if (!form.isValid || !targetContact) return

            try {
                editContact(targetContact.address, data)
                trackEvent(ContactsEvent.Edit)
            } catch (e) {
                if (e instanceof DuplicateAddressError) {
                    form.setError('address', {
                        message: t(
                            'contacts.add_contact.duplicate_address_error',
                        ),
                    })
                    return
                }
                if (e instanceof ContactNotFoundError) {
                    // The contact was removed (e.g. on another device)
                    // between selection and save. Drop the stale
                    // selection and pop back rather than reporting a
                    // false success.
                    setSelectedContact(null)
                    navigation.goBack()
                    return
                }
                throw e
            }

            // Keep the saved contact as selected so ViewContact re-renders
            // with the updated values when we pop back.
            setSelectedContact(data)
            navigation.goBack()
        },
        [form, t, editContact, targetContact, setSelectedContact, navigation],
    )

    /** Settles the backup's copy before the contact leaves the device: a
     *  refused choice must not strand a removed contact in a state the user
     *  never picked. */
    const removeContact = useCallback(
        async (backupChoice?: ContactBackupChoice) => {
            if (!targetContact) {
                navigation.replace('Contacts')
                return
            }

            if (backupChoice) {
                let isSettled = false
                try {
                    const manager = getBackupSyncManager()
                    isSettled =
                        backupChoice === 'delete'
                            ? await manager.deleteContactFromBackup(
                                  targetContact.address,
                              )
                            : await manager.keepContactInBackup(
                                  targetContact.address,
                                  targetContact.name,
                              )
                } catch (error) {
                    logger.warn('useEditContactForm: backup choice failed', {
                        address: targetContact.address,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    })
                }
                if (!isSettled) {
                    showToast({
                        title: t(
                            backupChoice === 'delete'
                                ? 'cloud_backup.contacts.delete_error'
                                : 'cloud_backup.contacts.keep_error',
                        ),
                        body: '',
                        type: 'error',
                    })
                    return
                }
            }

            // `deleteContact` reports whether it matched. A deeplink can name an
            // address that was never saved, in which case the target is
            // synthesized from the link and there is nothing to remove — don't
            // report a Delete that didn't happen or clear a selection we never
            // owned.
            if (deleteContact(targetContact)) {
                trackEvent(ContactsEvent.Delete)
                setSelectedContact(null)
            }
            navigation.replace('Contacts')
        },
        [
            targetContact,
            deleteContact,
            setSelectedContact,
            navigation,
            showToast,
            t,
        ],
    )

    return useMemo(
        () => ({
            ...form,
            contact: targetContact,
            needsBackupChoice,
            save,
            removeContact,
        }),
        [form, targetContact, needsBackupChoice, save, removeContact],
    )
}
