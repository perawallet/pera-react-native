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

import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real module constructs a NativeEventEmitter at import time and crashes
// the whole app at boot on any binary that doesn't bundle the RNWallet
// TurboModule — the service must not evaluate it until a method is called.
const state = vi.hoisted(() => ({
    isLibraryEvaluated: false,
    shouldRejectCalls: false,
}))

vi.mock('@expensify/react-native-wallet', () => {
    state.isLibraryEvaluated = true
    const guard = <T>(value: T): Promise<T> =>
        state.shouldRejectCalls
            ? Promise.reject(
                  new Error('Failed to load Wallet module, make sure to link'),
              )
            : Promise.resolve(value)
    return {
        checkWalletAvailability: () => guard(true),
        getCardStatusBySuffix: () => guard('active'),
        addCardToAppleWallet: () => guard('success'),
        addCardToGoogleWallet: () => guard('success'),
    }
})

import { RNWalletProvisioningService } from '../services/wallet-provisioning'

describe('RNWalletProvisioningService', () => {
    beforeEach(() => {
        state.shouldRejectCalls = false
    })

    it('does not evaluate the native library at construction time', () => {
        void new RNWalletProvisioningService()

        expect(state.isLibraryEvaluated).toBe(false)
    })

    it('loads the library on first use and delegates', async () => {
        const service = new RNWalletProvisioningService()

        await expect(service.checkWalletAvailability()).resolves.toBe(true)
        expect(state.isLibraryEvaluated).toBe(true)
        await expect(service.getCardStatusBySuffix('2234')).resolves.toBe(
            'active',
        )
    })

    it('maps probe call failures to unavailable answers', async () => {
        // The library rejects like this when its JS loads but the TurboModule
        // is absent (react-native-web) or TapAndPay isn't allowlisted.
        state.shouldRejectCalls = true
        const service = new RNWalletProvisioningService()

        await expect(service.checkWalletAvailability()).resolves.toBe(false)
        await expect(service.getCardStatusBySuffix('2234')).resolves.toBe(
            'not found',
        )
    })
})
