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
    firstUnreachableChainsNote,
    useAccountsStore,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useContacts, type Contact } from '@perawallet/wallet-core-contacts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import {
    useSendAccountResolver,
    useSendFundsStore,
} from '@modules/transactions'

type UseAccountActionsParams = {
    address: string
    label?: string
    /** Without one, the address's chain is unknown and actions aren't narrowed. */
    chainId?: ChainId
    onClose: () => void
}

type UseAccountActionsResult = {
    /**
     * Every contact saved at this address; more than one when the same person
     * is kept as two contacts. The sheet offers "Edit Contact" for each, or
     * "Add New Contact" when there are none.
     */
    existingContacts: Contact[]
    canSend: boolean
    /** Why no held account can send on the address's chain; null when one can, or no kind says why. */
    sendUnavailableNote: Nullable<string>
    canAddWatchAccount: boolean
    openSendTransaction: () => void
    openWatchAddress: () => void
    addContact: () => void
    editContact: (contact: Contact) => void
}

export const useAccountActions = ({
    address,
    label,
    chainId,
    onClose,
}: UseAccountActionsParams): UseAccountActionsResult => {
    const navigation = useAppNavigation()
    const { requestByType } = useBottomSheet()
    const { contacts, setSelectedContact } = useContacts()
    const { resolve: resolveSender, pick: pickSender } =
        useSendAccountResolver()
    const canAddWatchAccount = useCapability(
        chainId
            ? { chain: { chainId, capability: 'watchAccounts' } }
            : { anyChain: 'watchAccounts' },
    )
    const isSendOnChain = useCapability(
        chainId ? { chain: { chainId, capability: 'send' } } : {},
    )
    const hasNoSender =
        isSendOnChain && !!chainId && resolveSender(chainId).kind === 'none'
    const canSend = isSendOnChain && !hasNoSender
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    const sendUnavailableNote = useMemo(() => {
        if (!hasNoSender || !chainId) return null
        const note = firstUnreachableChainsNote(accounts, [chainId])
        return note ? t(note) : null
    }, [hasNoSender, chainId, accounts, t])

    const existingContacts = useMemo(
        // The address may be on any chain, so any of a contact's families can hold it.
        () =>
            contacts.filter(c => Object.values(c.addresses).includes(address)),
        [contacts, address],
    )

    const openSendFrom = useCallback(
        (sender: WalletAccount | undefined) => {
            // The send runs on the selected account's chain.
            if (sender)
                useAccountsStore.getState().setSelectedAccountId(sender.id)
            const sendFundsStore = useSendFundsStore.getState()
            sendFundsStore.reset()
            sendFundsStore.setDestination(address)
            if (chainId) sendFundsStore.setChainId(chainId)
            void requestByType(
                'send-funds',
                {},
                {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            )
        },
        [address, chainId, requestByType],
    )

    const openSendTransaction = useCallback(() => {
        onClose()
        if (!chainId) {
            openSendFrom(undefined)
            return
        }
        const resolution = resolveSender(chainId)
        if (resolution.kind === 'none') return
        if (resolution.kind !== 'picker') {
            openSendFrom(resolution.account)
            return
        }
        void pickSender(chainId, resolution.accounts).then(sender => {
            if (sender) openSendFrom(sender)
        })
    }, [chainId, onClose, openSendFrom, pickSender, resolveSender])

    const openWatchAddress = useCallback(() => {
        onClose()
        navigation.navigate('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: address },
        })
    }, [address, navigation, onClose])

    const addContact = useCallback(() => {
        onClose()
        navigation.navigate('Contacts', {
            screen: 'AddContact',
            params: { address, label, chainId },
        })
    }, [address, label, chainId, navigation, onClose])

    const editContact = useCallback(
        (contact: Contact) => {
            onClose()
            // EditContactScreen reads the contact via the contacts store
            // (selectedContact), not route params — set it before navigating
            // so the form opens populated.
            setSelectedContact(contact)
            navigation.navigate('Contacts', { screen: 'EditContact' })
        },
        [navigation, onClose, setSelectedContact],
    )

    return {
        existingContacts,
        canSend,
        sendUnavailableNote,
        canAddWatchAccount,
        openSendTransaction,
        openWatchAddress,
        addContact,
        editContact,
    }
}
