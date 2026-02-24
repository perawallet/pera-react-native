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

import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

export type UseKeyboardHeightResult = {
    keyboardHeight: number
    isKeyboardVisible: boolean
}

export function useKeyboardHeight(): UseKeyboardHeightResult {
    const [keyboardHeight, setKeyboardHeight] = useState(0)
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardWillShow', e => {
            setIsKeyboardVisible(true)
            setKeyboardHeight(e.endCoordinates.height)
        })
        const hideSubscription = Keyboard.addListener(
            'keyboardWillHide',
            () => {
                setIsKeyboardVisible(false)
                setKeyboardHeight(0)
            },
        )

        return () => {
            showSubscription.remove()
            hideSubscription.remove()
        }
    }, [])

    return { keyboardHeight, isKeyboardVisible }
}
