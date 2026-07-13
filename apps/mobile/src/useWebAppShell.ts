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

import { useEffect, useRef, useState } from 'react'
import { getSurface } from '@perawallet/wallet-extension-platform-chrome'
import { armAutoLock } from '@perawallet/wallet-extension-keystore-chrome'
import { useVaultLockState } from '@modules/vault'
import { useShowOnboarding } from '@hooks/useShowOnboarding'
import { hydrateKeystore } from '@perawallet/wallet-extension-provider'

export type WebShellState =
    | 'resolving'
    | 'create-password'
    | 'onboarding'
    | 'main'
    | 'approval-placeholder'

type UseWebAppShellResult = { shellState: WebShellState }

export const useWebAppShell = (): UseWebAppShellResult => {
    const { isInitialized, isUnlocked } = useVaultLockState()
    const showOnboarding = useShowOnboarding()
    const [isKeystoreHydrated, setIsKeystoreHydrated] = useState(false)
    const hydrationStarted = useRef(false)

    useEffect(() => {
        if (!isUnlocked || hydrationStarted.current) return
        hydrationStarted.current = true
        const hydrate = async (): Promise<void> => {
            await hydrateKeystore()
            setIsKeystoreHydrated(true)
        }
        void hydrate()
    }, [isUnlocked])

    useEffect(() => {
        if (!isUnlocked) return
        void armAutoLock() // sliding window: surface open re-arms
    }, [isUnlocked])

    if (getSurface() === 'approval') {
        return { shellState: 'approval-placeholder' }
    }
    if (isInitialized === null || isUnlocked === null) {
        return { shellState: 'resolving' }
    }
    if (!isInitialized) return { shellState: 'create-password' }
    if (isUnlocked && !isKeystoreHydrated) return { shellState: 'resolving' }
    // isInitialized && !isUnlocked never reaches here — VaultGate intercepts.
    return { shellState: showOnboarding ? 'onboarding' : 'main' }
}
