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
    contactFromFormValues,
    ContactNotFoundError,
    useContacts,
    type ContactFormValues,
    type NewContact,
} from '@perawallet/wallet-core-contacts'

import { getBackupSyncManager } from '@perawallet/wallet-core-backup'
import { logger, toError } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useSingleFlight } from '@hooks/useSingleFlight'
import { useIsCloudBackupAvailable } from '@hooks/useIsCloudBackupAvailable'
import { useIsContactBackedUp } from '@modules/cloud-backup'
import { trackEvent, ContactsEvent } from '@analytics'
import { contactFamilyOf } from '../utils/contactFamily'
import { useContactForm, type UseContactFormResult } from './useContactForm'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ContactsStackParamsList } from '@modules/contacts/routes'

export type ContactBackupChoice = 'delete' | 'keep'

export type UseEditContactFormResult = UseContactFormResult & {
    /**
     * The contact being edited: the deeplink target when the screen was reached
     * via QR/deeplink, otherwise the in-app store selection. Deliberately not
     * named `selectedContact` — it is no longer always the store's selection.
     * Without an `id` when the link names an address no contact holds.
     */
    contact: NewContact | null
    /** True when removing this contact needs the cloud-backup choice first. */
    needsBackupChoice: boolean
    save: (data: ContactFormValues) => void
    removeContact: (backupChoice?: ContactBackupChoice) => Promise<void>
    isRemoving: boolean
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
    const family = contactFamilyOf(route.params?.chainId)
    const targetContact = useMemo<NewContact | null>(() => {
        if (!routeAddress) return selectedContact
        return (
            contacts.find(
                contact => contact.addresses[family] === routeAddress,
            ) ?? {
                addresses: { [family]: routeAddress },
                name: routeLabel ?? '',
            }
        )
    }, [family, routeAddress, routeLabel, contacts, selectedContact])

    const form = useContactForm(targetContact)
    const targetId = targetContact?.id ?? ''

    const { errorToast } = useToast()
    const isCloudBackupAvailable = useIsCloudBackupAvailable()
    const isBackedUp = useIsContactBackedUp(targetId)
    const needsBackupChoice = isCloudBackupAvailable && isBackedUp

    const save = useCallback(
        (data: ContactFormValues) => {
            if (!form.isValid || !targetContact) return

            const contact = {
                ...contactFromFormValues(data),
                id: targetId,
            }
            try {
                editContact(targetId, contact)
                trackEvent(ContactsEvent.Edit)
            } catch (e) {
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
            setSelectedContact(contact)
            navigation.goBack()
        },
        [
            form,
            editContact,
            targetContact,
            targetId,
            setSelectedContact,
            navigation,
        ],
    )

    const { isPending: isRemoving, run: runRemoval } = useSingleFlight()

    /** Records the backup choice before the contact leaves the device: a
     *  refused choice would strand it in neither review bucket. */
    const removeContactOnce = useCallback(
        async (backupChoice?: ContactBackupChoice) => {
            if (!targetContact) {
                navigation.replace('Contacts')
                return
            }

            if (backupChoice) {
                let isRecorded = false
                try {
                    const manager = getBackupSyncManager()
                    isRecorded =
                        backupChoice === 'delete'
                            ? (await manager.deleteContactFromBackup(
                                  targetId,
                              )) !== 'refused'
                            : await manager.keepContactInBackup(
                                  targetId,
                                  targetContact.name,
                              )
                } catch (error) {
                    logger.warn('useEditContactForm: backup choice failed', {
                        id: targetId,
                        error: toError(error).message,
                    })
                }
                if (!isRecorded) {
                    errorToast(
                        t(
                            backupChoice === 'delete'
                                ? 'cloud_backup.contacts.delete_error'
                                : 'cloud_backup.contacts.keep_error',
                        ),
                        '',
                    )
                    return
                }
            }

            // `deleteContact` reports whether it matched. A deeplink can name an
            // address that was never saved, in which case the target is
            // synthesized from the link, has no id and there is nothing to
            // remove — don't report a Delete that didn't happen or clear a
            // selection we never owned.
            if (deleteContact(targetId)) {
                trackEvent(ContactsEvent.Delete)
                setSelectedContact(null)
            }
            navigation.replace('Contacts')
        },
        [
            targetContact,
            targetId,
            deleteContact,
            setSelectedContact,
            navigation,
            errorToast,
            t,
        ],
    )

    const removeContact = useCallback(
        async (backupChoice?: ContactBackupChoice) => {
            await runRemoval(() => removeContactOnce(backupChoice))
        },
        [runRemoval, removeContactOnce],
    )

    return useMemo(
        () => ({
            ...form,
            contact: targetContact,
            needsBackupChoice,
            save,
            removeContact,
            isRemoving,
        }),
        [
            form,
            targetContact,
            needsBackupChoice,
            save,
            removeContact,
            isRemoving,
        ],
    )
}
