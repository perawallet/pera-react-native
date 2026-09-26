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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { nameServiceChainAdapters } from '../../chain-adapter'
import { verifyNameAddress } from '../verifyNameAddress'
import { registerFakeNameServiceAdapter } from '../../__tests__/fakeNameServiceAdapter'

const ADDRESS = 'A'.repeat(58)

describe('verifyNameAddress', () => {
    beforeEach(() => {
        nameServiceChainAdapters.reset()
    })

    it("delegates to the network's chain adapter with the network's scope", async () => {
        const verifyForwardResolution = vi.fn().mockResolvedValue('verified')
        registerFakeNameServiceAdapter({ verifyForwardResolution })
        const { signal } = new AbortController()

        const result = await verifyNameAddress({
            name: 'alice.algo',
            address: ADDRESS,
            network: 'testnet',
            signal,
        })

        expect(result).toBe('verified')
        expect(verifyForwardResolution).toHaveBeenCalledWith({
            name: 'alice.algo',
            address: ADDRESS,
            scope: { chainId: 'algorand', networkId: 'testnet' },
            signal,
        })
    })

    it('is unavailable when the chain has no way to verify a name', async () => {
        registerFakeNameServiceAdapter()

        await expect(
            verifyNameAddress({
                name: 'alice.algo',
                address: ADDRESS,
                network: 'mainnet',
            }),
        ).resolves.toBe('unavailable')
    })

    it('throws when no adapter is registered for the chain', async () => {
        await expect(
            verifyNameAddress({
                name: 'alice.algo',
                address: ADDRESS,
                network: 'mainnet',
            }),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
    })
})
