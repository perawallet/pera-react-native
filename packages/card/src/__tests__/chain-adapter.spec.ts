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

import { beforeEach, describe, expect, it } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { compileAutoDrawProgram, resolveEscrowChainConfig } from '../api/escrow'
import { cardAdapterFor, cardChainAdapters } from '../chain-adapter'
import { isKillswitchConfigured } from '../hooks/useKillswitchAutoDraw'
import { fakeCardAdapter, registerFakeCardAdapter } from './fakeCardAdapter'

describe('cardAdapterFor', () => {
    beforeEach(() => {
        cardChainAdapters.reset()
    })

    it("resolves a legacy network to its chain's adapter", () => {
        const adapter = fakeCardAdapter()
        cardChainAdapters.register(adapter)

        expect(cardAdapterFor('testnet')).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => cardAdapterFor('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => cardAdapterFor('mainnet')).toThrow(
            'No card adapter is registered for chain "algorand"',
        )
    })
})

describe('chain-backed card helpers', () => {
    it('fail closed when no adapter is registered', async () => {
        cardChainAdapters.reset()

        expect(() => resolveEscrowChainConfig('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => isKillswitchConfigured('mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        await expect(
            compileAutoDrawProgram({ network: 'mainnet' }),
        ).rejects.toThrow(ChainAdapterNotRegisteredError)
    })

    it('ask the adapter for the given network', async () => {
        const program = new Uint8Array([6, 129, 1])
        const adapter = registerFakeCardAdapter({
            compileAutoDrawProgram: async () => program,
            autoDraw: { isConfigured: () => false },
        })

        expect(resolveEscrowChainConfig('testnet')).toEqual({
            assetId: '31566704',
            killswitchAppId: '222',
            mainAppId: '111',
        })
        expect(adapter.resolveEscrowChainConfig).toHaveBeenCalledWith('testnet')
        expect(isKillswitchConfigured('testnet')).toBe(false)
        await expect(
            compileAutoDrawProgram({ network: 'testnet' }),
        ).resolves.toBe(program)
    })
})
