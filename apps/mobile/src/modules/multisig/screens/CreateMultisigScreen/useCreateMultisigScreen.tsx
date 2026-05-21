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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    DuplicateAddressError,
    useContacts,
} from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddParticipantContent } from '../../components/AddParticipantContent'
import {
    useMultisigCreationStore,
    type Participant,
} from '../../hooks/useMultisigCreation'

type UseCreateMultisigScreenResult = {
    participants: Participant[]
    canContinue: boolean
    isParticipantInWallet: (address: string) => boolean
    handleOpenAddParticipant: () => Promise<void>
    handleEditParticipant: (address: string) => void
    handleRemoveParticipant: (address: string) => void
    handleContinue: () => void
}

export const useCreateMultisigScreen = (): UseCreateMultisigScreenResult => {
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const accounts = useAllAccounts()
    const { addContact, contacts } = useContacts()
    const participants = useMultisigCreationStore(state => state.participants)
    const addParticipant = useMultisigCreationStore(
        state => state.addParticipant,
    )
    const removeParticipant = useMultisigCreationStore(
        state => state.removeParticipant,
    )

    const canContinue = participants.length >= 2

    const isParticipantInWallet = useCallback(
        (address: string) => accounts.some(a => a.address === address),
        [accounts],
    )

    const handleAddAddress = useCallback(
        (address: string) => {
            if (participants.some(p => p.address === address)) return
            addParticipant({ address })

            // Auto-save a non-wallet address as a contact so it gets a
            // friendly name and is reusable later. Skip wallet accounts and
            // addresses that are already contacts.
            const isWalletAccount = accounts.some(a => a.address === address)
            const isExistingContact = contacts.some(c => c.address === address)
            if (isWalletAccount || isExistingContact) return

            try {
                addContact({ name: truncateAlgorandAddress(address), address })
            } catch (e) {
                // Defensive: ignore a concurrent duplicate; rethrow anything
                // else since that would be a real bug.
                if (!(e instanceof DuplicateAddressError)) throw e
            }
        },
        [accounts, contacts, addContact, addParticipant, participants],
    )

    const handleOpenAddParticipant = useCallback(async () => {
        const address = await requestBottomSheet<string>({
            contents: <AddParticipantContent />,
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!address) return
        handleAddAddress(address)
    }, [requestBottomSheet, handleAddAddress])

    const handleEditParticipant = useCallback(
        (address: string) => {
            navigation.push('EditParticipant', { address })
        },
        [navigation],
    )

    const handleRemoveParticipant = useCallback(
        (address: string) => {
            removeParticipant(address)
        },
        [removeParticipant],
    )

    const handleContinue = useCallback(() => {
        navigation.push('SetThreshold')
    }, [navigation])

    return {
        participants,
        canContinue,
        isParticipantInWallet,
        handleOpenAddParticipant,
        handleEditParticipant,
        handleRemoveParticipant,
        handleContinue,
    }
}
