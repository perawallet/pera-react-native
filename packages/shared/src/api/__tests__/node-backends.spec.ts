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

const adapter = (
    describeError?: NodeBackendsAdapter['describeError'],
    chainId = 'test:chain' as ChainId,
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

        expect(describeNodeError(error)).toBe(copy)
        expect(describeError).toHaveBeenCalledWith(error)
    })

    it('returns the copy of whichever chain recognises the error', () => {
        const copy = { titleKey: 't', bodyKey: 'b', params: {} }
        nodeBackendAdapters.register(
            adapter(() => undefined, 'first:chain' as ChainId),
        )
        nodeBackendAdapters.register(
            adapter(() => copy, 'second:chain' as ChainId),
        )

        expect(describeNodeError(new Error('boom'))).toBe(copy)
    })

    it('returns undefined when no adapter is registered', () => {
        expect(describeNodeError(new Error('boom'))).toBeUndefined()
    })

    it('returns undefined when no adapter has describeError', () => {
        nodeBackendAdapters.register(adapter())

        expect(describeNodeError(new Error('boom'))).toBeUndefined()
    })
})
