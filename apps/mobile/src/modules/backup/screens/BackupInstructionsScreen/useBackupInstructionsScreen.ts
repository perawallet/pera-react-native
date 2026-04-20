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

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

export type UseBackupInstructionsScreenResult = {
    isPinVisible: boolean
    openPin: () => void
    closePin: () => void
    handlePinVerified: () => void
}

export const useBackupInstructionsScreen =
    (): UseBackupInstructionsScreenResult => {
        const navigation = useNavigation()
        const [isPinVisible, setIsPinVisible] = useState(false)

        const openPin = useCallback(() => setIsPinVisible(true), [])
        const closePin = useCallback(() => setIsPinVisible(false), [])
        const handlePinVerified = useCallback(() => {
            setIsPinVisible(false)
            ;(
                navigation as unknown as { navigate: (name: string) => void }
            ).navigate('BackupMnemonic')
        }, [navigation])

        return { isPinVisible, openPin, closePin, handlePinVerified }
    }
