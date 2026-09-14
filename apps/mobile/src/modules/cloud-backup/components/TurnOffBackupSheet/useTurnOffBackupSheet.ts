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

import { useCallback } from 'react'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type TurnOffBackupChoice = 'turnOff' | 'turnOffAndRemove'

type UseTurnOffBackupSheetResult = {
    handleKeep: () => void
    handleTurnOff: () => void
    handleTurnOffAndRemove: () => void
}

export const useTurnOffBackupSheet = (): UseTurnOffBackupSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<TurnOffBackupChoice>()

    const handleKeep = useCallback(() => {
        trackEvent(CloudBackupEvent.TurnOffKeep)
        dismiss()
    }, [dismiss])

    const handleTurnOff = useCallback(() => {
        trackEvent(CloudBackupEvent.TurnOffDisable)
        resolve('turnOff')
    }, [resolve])

    const handleTurnOffAndRemove = useCallback(() => {
        trackEvent(CloudBackupEvent.TurnOffRemove)
        resolve('turnOffAndRemove')
    }, [resolve])

    return { handleKeep, handleTurnOff, handleTurnOffAndRemove }
}
