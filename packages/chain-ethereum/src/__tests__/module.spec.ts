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

import { describe, expect, it, vi } from 'vitest'
import {
    addressCodecs,
    createChainRegistry,
    keyDerivations,
    registerChainSetup,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumModule } from '..'
import { ethereumAddressCodec } from '../addresses'
import { ethereumKeyDerivation } from '../keys/derivation'

const context: ChainContext = {
    getScope: vi.fn(),
    getEndpoints: vi.fn(),
    http: { request: vi.fn() },
    kms: { deriveFromSeed: vi.fn(), importRawKey: vi.fn(), sign: vi.fn() },
} as unknown as ChainContext

const ENABLED = [
    'send',
    'receive',
    'history',
    'assets',
    'pricing',
    'messageSigning',
    'dappConnect',
    'watchAccounts',
    'privateKeys',
    'cloudBackup',
    'mnemonicBackup',
]

describe('ethereumModule', () => {
    it('switches on exactly the launch capabilities', () => {
        const enabled = Object.entries(ethereumModule.capabilityDefaults)
            .filter(([, isOn]) => isOn)
            .map(([capability]) => capability)

        expect(enabled.sort()).toEqual([...ENABLED].sort())
    })

    it('registers its descriptor, address codec, key derivation and defaults through the setup', () => {
        const chains = createChainRegistry()

        registerChainSetup(
            [
                {
                    chainId: 'ethereum',
                    enabled: true,
                    module: ethereumModule,
                    endpoints: {},
                },
            ],
            chains,
            () => context,
        )

        expect(chains.get('ethereum').descriptor).toBe(
            ethereumModule.descriptor,
        )
        expect(chains.capabilities('ethereum')).toEqual(
            ethereumModule.capabilityDefaults,
        )
        expect(addressCodecs.get('ethereum')).toBe(ethereumAddressCodec)
        expect(keyDerivations.get('ethereum')).toBe(ethereumKeyDerivation)
        expect(chains.byCaip2('eip155:11155111')).toMatchObject({
            chainId: 'ethereum',
            network: { id: 'sepolia' },
        })
    })

    it('has no i18n keys yet', () => {
        expect(ethereumModule.i18nKeys()).toEqual([])
    })
})
