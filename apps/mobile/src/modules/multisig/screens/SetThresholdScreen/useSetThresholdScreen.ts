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
import { useMultisigCreationStore } from '../../hooks/useMultisigCreation'

type UseSetThresholdScreenResult = {
    threshold: number
    participantCount: number
    isBeforeCreateVisible: boolean
    handleIncrement: () => void
    handleDecrement: () => void
    handleContinue: () => void
    handleCloseBeforeCreate: () => void
    handleProceed: () => void
}

export const useSetThresholdScreen = (): UseSetThresholdScreenResult => {
    const navigation = useAppNavigation()
    const threshold = useMultisigCreationStore(state => state.threshold)
    const participants = useMultisigCreationStore(state => state.participants)
    const setThreshold = useMultisigCreationStore(state => state.setThreshold)

    const participantCount = participants.length

    const {
        isOpen: isBeforeCreateVisible,
        open: openBeforeCreate,
        close: closeBeforeCreate,
    } = useModalState()

    const handleIncrement = useCallback(() => {
        if (threshold < participantCount) {
            setThreshold(threshold + 1)
        }
    }, [threshold, participantCount, setThreshold])

    const handleDecrement = useCallback(() => {
        if (threshold > 1) {
            setThreshold(threshold - 1)
        }
    }, [threshold, setThreshold])

    const handleContinue = useCallback(() => {
        openBeforeCreate()
    }, [openBeforeCreate])

    const handleCloseBeforeCreate = useCallback(() => {
        closeBeforeCreate()
    }, [closeBeforeCreate])

    const handleProceed = useCallback(() => {
        closeBeforeCreate()
        navigation.push('NameMultisig')
    }, [closeBeforeCreate, navigation])

    return {
        threshold,
        participantCount,
        isBeforeCreateVisible,
        handleIncrement,
        handleDecrement,
        handleContinue,
        handleCloseBeforeCreate,
        handleProceed,
    }
}
