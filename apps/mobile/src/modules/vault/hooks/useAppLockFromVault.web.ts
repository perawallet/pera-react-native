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

import { useEffect } from 'react'
import { useSecurityStore } from '@perawallet/wallet-core-security'
import { useVaultLockState } from './useVaultLockState.web'

/**
 * The vault is the extension's app lock, so it writes the security store's
 * `isAppLockActive`, which native's AutoLockGuard listener owns. Without a
 * writer the store's fail-closed default (`true`) never clears, and anything
 * gated on it (the cloud backup sync) never runs. An unresolved lock state
 * counts as locked.
 */
export const useAppLockFromVault = (): void => {
    const { isUnlocked } = useVaultLockState()
    const setAppLockActive = useSecurityStore(state => state.setAppLockActive)

    useEffect(() => {
        setAppLockActive(isUnlocked !== true)
    }, [isUnlocked, setAppLockActive])

    // VaultGate unmounts the main surface as the vault locks, possibly before
    // the lock event reaches this hook.
    useEffect(() => () => setAppLockActive(true), [setAppLockActive])
}
