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

import { useEffect, useState } from 'react'
import {
    hasRecentPasswordAuth,
    isPasskeyUnlockEnabled,
    isPasskeyUnlockSupported,
} from '@perawallet/wallet-extension-keystore-chrome'
import type { UsePasskeyUnlockOfferPromptResult } from './usePasskeyUnlockOfferPrompt'

/**
 * Due only inside the keystore's reauth window, so enabling from the prompt
 * usually needs no password; one that lapses while queued asks for it. Re-read
 * on every mount, because each popup open is a new realm.
 */
export const usePasskeyUnlockOfferPrompt =
    (): UsePasskeyUnlockOfferPromptResult => {
        const [isDue, setIsDue] = useState(false)

        useEffect(() => {
            let isCancelled = false
            void Promise.all([
                isPasskeyUnlockSupported(),
                isPasskeyUnlockEnabled(),
                hasRecentPasswordAuth(),
            ]).then(([isSupported, isEnabled, hasRecentPassword]) => {
                if (isCancelled) return
                setIsDue(isSupported && !isEnabled && hasRecentPassword)
            })
            return () => {
                isCancelled = true
            }
        }, [])

        return { isDue }
    }
