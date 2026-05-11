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
    handleOpenAddParticipant: () => Promise<void>
    handleEditParticipant: (address: string) => void
    handleContinue: () => void
}

export const useCreateMultisigScreen = (): UseCreateMultisigScreenResult => {
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const participants = useMultisigCreationStore(state => state.participants)
    const addParticipant = useMultisigCreationStore(
        state => state.addParticipant,
    )

    const canContinue = participants.length >= 2

    const handleAddAddress = useCallback(
        (address: string) => {
            if (participants.some(p => p.address === address)) return
            addParticipant({ address })
        },
        [addParticipant, participants],
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

    const handleContinue = useCallback(() => {
        navigation.push('SetThreshold')
    }, [navigation])

    return {
        participants,
        canContinue,
        handleOpenAddParticipant,
        handleEditParticipant,
        handleContinue,
    }
}
