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

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { isForegroundTransition } from '@utils/app-state'

type UseClipboardAddressResult = {
    clipboardAddress: string | null
    refreshClipboard: () => Promise<void>
}

export const useClipboardAddress = (): UseClipboardAddressResult => {
    const [clipboardAddress, setClipboardAddress] = useState<string | null>(
        null,
    )
    const appStateRef = useRef(AppState.currentState)

    const refreshClipboard = useCallback(async () => {
        try {
            const content = await Clipboard.getStringAsync()
            const trimmed = content?.trim() ?? ''
            if (isValidAlgorandAddress(trimmed)) {
                setClipboardAddress(trimmed)
            } else {
                setClipboardAddress(null)
            }
        } catch {
            setClipboardAddress(null)
        }
    }, [])

    useEffect(() => {
        refreshClipboard()
    }, [refreshClipboard])

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (isForegroundTransition(appStateRef.current, nextState)) {
                refreshClipboard()
            }
            appStateRef.current = nextState
        })
        return () => subscription.remove()
    }, [refreshClipboard])

    return { clipboardAddress, refreshClipboard }
}
