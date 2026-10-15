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
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from '@perawallet/wallet-core-chain-contract'
import { multisigAdapterFor, multisigChainAdapters } from '../chain-adapter'
import { fakeMultisigAdapter } from './fakeMultisigAdapter'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

describe('multisigChainAdapters', () => {
    beforeEach(() => {
        multisigChainAdapters.reset()
    })

    it("resolves a scope to its chain's adapter", () => {
        const adapter = fakeMultisigAdapter()
        multisigChainAdapters.register(adapter)

        expect(
            multisigAdapterFor({ chainId: 'algorand', networkId: 'testnet' }),
        ).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => multisigAdapterFor(MAINNET)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => multisigAdapterFor(MAINNET)).toThrow(
            'No multisig adapter is registered for chain "algorand"',
        )
    })

    it('refuses a second adapter for the same chain', () => {
        multisigChainAdapters.register(fakeMultisigAdapter())

        expect(() =>
            multisigChainAdapters.register(fakeMultisigAdapter()),
        ).toThrow(DuplicateChainAdapterError)
    })
})
