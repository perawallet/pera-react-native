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

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    describeNodeError,
    nodeBackendAdapters,
    type NodeBackendsAdapter,
} from '../node-backends'

const chainId = 'test:chain' as ChainId

const adapter = (
    describeError?: NodeBackendsAdapter['describeError'],
): NodeBackendsAdapter => ({
    chainId,
    backendsFor: () => ({}),
    describeError,
})

describe('describeNodeError', () => {
    afterEach(() => nodeBackendAdapters.reset())

    it('returns the copy the registered adapter describes', () => {
        const copy = { titleKey: 't', bodyKey: 'b', params: { n: 1n } }
        const describeError = vi.fn(() => copy)
        nodeBackendAdapters.register(adapter(describeError))
        const error = new Error('boom')

        expect(describeNodeError(chainId, error)).toBe(copy)
        expect(describeError).toHaveBeenCalledWith(error)
    })

    it('returns undefined when no adapter is registered for the chain', () => {
        expect(describeNodeError(chainId, new Error('boom'))).toBeUndefined()
    })

    it('returns undefined when the adapter has no describeError', () => {
        nodeBackendAdapters.register(adapter())

        expect(describeNodeError(chainId, new Error('boom'))).toBeUndefined()
    })
})
