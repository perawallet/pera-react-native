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
import {
    AddParticipantContent,
    type AddParticipantResult,
} from '../../components/AddParticipantContent'
import {
    useMultisigCreationStore,
    type Participant,
} from '../../hooks/useMultisigCreation'

type UseCreateMultisigScreenResult = {
    participants: Participant[]
    canContinue: boolean
    isParticipantInWallet: (address: string) => boolean
    handleOpenAddParticipant: () => Promise<void>
    handleEditParticipant: (index: number) => void
    handleRemoveParticipant: (index: number) => void
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
        (address: string, nfdName?: string) => {
            // Duplicates are intentionally allowed: the Algorand multisig
            // primitive treats the address list as ordered, distinct slots,
            // so [A, B, B, A] is a valid composition. Carry over an existing
            // display name so the new row matches the others immediately,
            // falling back to the NFD name when the address came from an
            // NFD search result.
            const existingName =
                participants.find(p => p.address === address)?.name ??
                contacts.find(c => c.address === address)?.name
            addParticipant({ address, name: existingName ?? nfdName })

            // Auto-save a non-wallet address as a contact so it gets a
            // friendly name and is reusable later. Skip wallet accounts and
            // addresses that are already contacts.
            const isWalletAccount = accounts.some(a => a.address === address)
            const isExistingContact = contacts.some(c => c.address === address)
            if (isWalletAccount || isExistingContact) return

            try {
                // Prefer the NFD name as the nickname; only an address
                // typed/pasted without an NFD falls back to a truncation.
                addContact({
                    address,
                    name: nfdName ?? truncateAlgorandAddress(address),
                    ...(nfdName ? { nfd: nfdName } : {}),
                })
            } catch (e) {
                // Defensive: ignore a concurrent duplicate; rethrow anything
                // else since that would be a real bug.
                if (!(e instanceof DuplicateAddressError)) throw e
            }
        },
        [accounts, contacts, addContact, addParticipant, participants],
    )

    const handleOpenAddParticipant = useCallback(async () => {
        const result = await requestBottomSheet<AddParticipantResult>({
            contents: <AddParticipantContent />,
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!result) return
        handleAddAddress(result.address, result.nfdName)
    }, [requestBottomSheet, handleAddAddress])

    const handleEditParticipant = useCallback(
        (index: number) => {
            const participant = participants[index]
            if (!participant) return
            navigation.push('EditParticipant', {
                index,
                address: participant.address,
            })
        },
        [navigation, participants],
    )

    const handleRemoveParticipant = useCallback(
        (index: number) => {
            removeParticipant(index)
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
