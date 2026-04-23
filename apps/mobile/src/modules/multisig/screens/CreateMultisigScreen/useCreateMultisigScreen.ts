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
import { useModalState } from '@hooks/useModalState'
import {
    useMultisigCreationStore,
    type Participant,
} from '../../hooks/useMultisigCreation'

type UseCreateMultisigScreenResult = {
    participants: Participant[]
    isAddParticipantVisible: boolean
    canContinue: boolean
    handleOpenAddParticipant: () => void
    handleCloseAddParticipant: () => void
    handleAddAddress: (address: string) => void
    handleEditParticipant: (address: string) => void
    handleContinue: () => void
}

export const useCreateMultisigScreen = (): UseCreateMultisigScreenResult => {
    const navigation = useAppNavigation()
    const participants = useMultisigCreationStore(state => state.participants)
    const addParticipant = useMultisigCreationStore(
        state => state.addParticipant,
    )

    const {
        isOpen: isAddParticipantVisible,
        open: openAddParticipant,
        close: closeAddParticipant,
    } = useModalState()

    const canContinue = participants.length >= 2

    const handleOpenAddParticipant = useCallback(() => {
        openAddParticipant()
    }, [openAddParticipant])

    const handleCloseAddParticipant = useCallback(() => {
        closeAddParticipant()
    }, [closeAddParticipant])

    const handleAddAddress = useCallback(
        (address: string) => {
            if (participants.some(p => p.address === address)) return
            addParticipant({ address })
        },
        [addParticipant, participants],
    )

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
        isAddParticipantVisible,
        canContinue,
        handleOpenAddParticipant,
        handleCloseAddParticipant,
        handleAddAddress,
        handleEditParticipant,
        handleContinue,
    }
}
