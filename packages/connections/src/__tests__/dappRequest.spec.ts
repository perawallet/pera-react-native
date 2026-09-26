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
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '../dappRequest'

const fakeAdapter: DappRequestChainAdapter = {
    chainId: 'algorand',
    relayableErrorNames: [],
    parseSigningParams: () => ({ ok: true, payload: [] }),
    resolveReportedNetwork: network => network,
}

describe('dappRequestChainAdapters', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
    })

    it('returns the adapter registered for a chain', () => {
        dappRequestChainAdapters.register(fakeAdapter)

        expect(dappRequestChainAdapters.has('algorand')).toBe(true)
        expect(dappRequestChainAdapters.get('algorand')).toBe(fakeAdapter)
    })

    it('names the dapp-request feature when no adapter is registered', () => {
        expect(dappRequestChainAdapters.has('algorand')).toBe(false)
        expect(() => dappRequestChainAdapters.get('algorand')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => dappRequestChainAdapters.get('algorand')).toThrow(
            /dapp-request/,
        )
    })

    it('forgets every adapter on reset', () => {
        dappRequestChainAdapters.register(fakeAdapter)

        dappRequestChainAdapters.reset()

        expect(dappRequestChainAdapters.has('algorand')).toBe(false)
    })
})
