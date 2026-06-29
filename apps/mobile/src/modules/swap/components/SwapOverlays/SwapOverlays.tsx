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
import { AppState } from 'react-native'
import { useSwapCosignResolver } from '@perawallet/wallet-core-swaps'
import { useErrorToast } from '@hooks/useErrorToast'

/**
 * Headless app-root mount for the shared-account swap cosign resolver.
 *
 * Mirrors {@link MultisigOverlays}'s resolver wiring: tracks foreground state
 * so polling pauses while the app is backgrounded (iOS suspends JS timers
 * anyway), and drives {@link useSwapCosignResolver}, which finishes any
 * persisted shared-account swap once its co-signer has signed.
 */
export const SwapOverlays = (): null => {
    const [isAppActive, setIsAppActive] = useState(
        AppState.currentState === 'active',
    )

    const { showError } = useErrorToast()

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            setIsAppActive(nextState === 'active')
        })
        return () => subscription.remove()
    }, [])

    useSwapCosignResolver({ isAppActive, reportError: showError })

    return null
}
