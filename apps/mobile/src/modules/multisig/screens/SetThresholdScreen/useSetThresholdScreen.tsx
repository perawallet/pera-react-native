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
import { BeforeYouCreateContent } from '../../components/BeforeYouCreateContent'
import {
    useMultisigCreationStore,
    type Participant,
} from '../../hooks/useMultisigCreation'

type UseSetThresholdScreenResult = {
    threshold: number
    participants: Participant[]
    participantCount: number
    handleIncrement: () => void
    handleDecrement: () => void
    handleContinue: () => Promise<void>
}

export const useSetThresholdScreen = (): UseSetThresholdScreenResult => {
    const navigation = useAppNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const threshold = useMultisigCreationStore(state => state.threshold)
    const participants = useMultisigCreationStore(state => state.participants)
    const setThreshold = useMultisigCreationStore(state => state.setThreshold)

    const participantCount = participants.length

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

    const handleContinue = useCallback(async () => {
        const result = await requestBottomSheet<'proceed'>({
            contents: <BeforeYouCreateContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
            },
        })
        if (result !== 'proceed') return
        navigation.push('NameMultisig')
    }, [requestBottomSheet, navigation])

    return {
        threshold,
        participants,
        participantCount,
        handleIncrement,
        handleDecrement,
        handleContinue,
    }
}
