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
import { testChainContext } from './context'

const freshHolder = async () => {
    vi.resetModules()
    return import('../chain-context')
}

describe('the Algorand chain context holder', () => {
    afterEach(() => {
        vi.resetModules()
    })

    it('throws before a context is registered, so no request goes out unbounded', async () => {
        const { getAlgorandChainContext } = await freshHolder()

        expect(() => getAlgorandChainContext()).toThrow(
            expect.objectContaining({
                name: 'ChainAdapterNotRegisteredError',
                chainId: 'algorand',
            }),
        )
    })

    it('serves the latest registration', async () => {
        const { getAlgorandChainContext, setAlgorandChainContext } =
            await freshHolder()
        const first = testChainContext()
        const second = {
            ...testChainContext(),
            timeouts: { readMs: 1, submitMs: 2 },
        }

        setAlgorandChainContext(first)
        setAlgorandChainContext(second)

        expect(getAlgorandChainContext()).toBe(second)
    })
})
