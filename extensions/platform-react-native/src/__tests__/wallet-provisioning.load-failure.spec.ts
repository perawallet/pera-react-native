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

// A binary without the RNWallet TurboModule makes the library module itself
// throw on evaluation (module-scope NativeEventEmitter). Supported state, not
// an error: probes answer unavailable, only the add flows reject.
vi.mock('@expensify/react-native-wallet', () => {
    throw new Error('`new NativeEventEmitter()` requires a non-null argument.')
})

import { RNWalletProvisioningService } from '../services/wallet-provisioning'

describe('RNWalletProvisioningService (library fails to evaluate)', () => {
    const service = new RNWalletProvisioningService()

    it('reports the wallet as unavailable instead of erroring', async () => {
        await expect(service.checkWalletAvailability()).resolves.toBe(false)
    })

    it('reports the card as not found instead of erroring', async () => {
        await expect(service.getCardStatusBySuffix('2234')).resolves.toBe(
            'not found',
        )
    })

    it('rejects the add flows so callers fall back', async () => {
        await expect(
            service.addCardToAppleWallet(
                {
                    network: 'MASTERCARD',
                    cardHolderName: 'Ada Lovelace',
                    lastDigits: '2234',
                    cardDescription: 'Pera Card',
                },
                () => Promise.reject(new Error('unused')),
            ),
        ).rejects.toThrow('wallet module is unavailable')
        await expect(
            service.addCardToGoogleWallet({
                network: 'MASTERCARD',
                opaquePaymentCard: 'opc',
                cardHolderName: 'Ada Lovelace',
                lastDigits: '2234',
                userAddress: {
                    name: 'Ada Lovelace',
                    addressOne: '1 Main St',
                    administrativeArea: 'CA',
                    locality: 'San Francisco',
                    countryCode: 'US',
                    postalCode: '94100',
                    phoneNumber: '+14150000000',
                },
            }),
        ).rejects.toThrow('wallet module is unavailable')
    })
})
