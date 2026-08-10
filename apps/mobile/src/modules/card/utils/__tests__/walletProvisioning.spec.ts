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

import { describe, it, expect, vi } from 'vitest'

// Tracks when the library module body actually runs. The real module
// constructs a NativeEventEmitter at import time and crashes the whole app at
// boot on any binary that doesn't bundle the RNWallet TurboModule (e.g. a dev
// client built before the dependency landed) — so the adapter must not
// evaluate it until a function is first called.
const state = vi.hoisted(() => ({ isLibraryEvaluated: false }))

vi.mock('@expensify/react-native-wallet', () => {
    state.isLibraryEvaluated = true
    return {
        checkWalletAvailability: () => Promise.resolve(true),
        getCardStatusBySuffix: () => Promise.resolve('active'),
        addCardToAppleWallet: () => Promise.resolve('success'),
        addCardToGoogleWallet: () => Promise.resolve('success'),
    }
})

import {
    checkWalletAvailability,
    getCardStatusBySuffix,
    isNativeWalletSupported,
} from '../walletProvisioning'

describe('walletProvisioning', () => {
    it('does not evaluate the native library at import time', () => {
        expect(isNativeWalletSupported).toBe(true)
        expect(state.isLibraryEvaluated).toBe(false)
    })

    it('loads the library on first use and delegates', async () => {
        await expect(checkWalletAvailability()).resolves.toBe(true)
        expect(state.isLibraryEvaluated).toBe(true)

        await expect(getCardStatusBySuffix('2234')).resolves.toBe('active')
    })
})
