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

// A binary without the RNWallet TurboModule (e.g. a dev client built before
// the dependency landed) makes the library module itself throw on evaluation.
// That's a supported state, not an error: the read APIs must resolve to their
// "unavailable" values so the global query error logger stays quiet, and only
// the add flows (which should never run then) may reject.
vi.mock('@expensify/react-native-wallet', () => {
    throw new Error(
        '`new NativeEventEmitter()` requires a non-null argument.',
    )
})

import {
    addCardToAppleWallet,
    checkWalletAvailability,
    getCardStatusBySuffix,
} from '../walletProvisioning'

describe('walletProvisioning (library fails to load)', () => {
    it('reports the wallet as unavailable instead of erroring', async () => {
        await expect(checkWalletAvailability()).resolves.toBe(false)
    })

    it('reports the card as not found instead of erroring', async () => {
        await expect(getCardStatusBySuffix('2234')).resolves.toBe('not found')
    })

    it('rejects the add flow so callers fall back', async () => {
        await expect(
            addCardToAppleWallet(
                {
                    network: 'MASTERCARD',
                    cardHolderName: 'Ada Lovelace',
                    lastDigits: '2234',
                    cardDescription: 'Pera Card',
                },
                () => Promise.reject(new Error('unused')),
            ),
        ).rejects.toThrow('wallet module is unavailable')
    })
})
