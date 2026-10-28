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

// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { registerFakeChain } from '../../__tests__/fakeChains'
import { registerFakeRampAdapters } from '../../__tests__/fakeRampAdapter'
import { onrampChainIdOf, useOnrampScope } from '../useOnrampScope'

const ON_BOTH_CHAINS = { algorand: {}, ethereum: {} }

describe('onrampChainIdOf', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        registerFakeChain({ chainId: 'algorand', caip2: 'algorand:a' })
        registerFakeChain({ chainId: 'ethereum', caip2: 'eip155:1' })
        registerFakeRampAdapters(
            { chainId: 'algorand' },
            { chainId: 'ethereum' },
        )
    })

    test('takes the first eligible chain in registry order', () => {
        expect(onrampChainIdOf(ON_BOTH_CHAINS, () => true)).toBe('algorand')
    })

    test('skips a chain without the capability', () => {
        expect(
            onrampChainIdOf(ON_BOTH_CHAINS, chainId => chainId === 'ethereum'),
        ).toBe('ethereum')
    })

    test('skips a chain the account is not on', () => {
        expect(onrampChainIdOf({ ethereum: {} }, () => true)).toBe('ethereum')
    })

    test('skips a chain with no ramp adapter', () => {
        registerFakeRampAdapters({ chainId: 'ethereum' })

        expect(onrampChainIdOf({ algorand: {} }, () => true)).toBeNull()
    })

    test('is null when nothing qualifies', () => {
        expect(onrampChainIdOf({}, () => true)).toBeNull()
        expect(onrampChainIdOf(ON_BOTH_CHAINS, () => false)).toBeNull()
    })
})

describe('useOnrampScope', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        registerFakeRampAdapters({ chainId: 'algorand' })
    })

    test("is the chain's selected network when it has onramp", () => {
        registerFakeChain({ chainId: 'algorand', caip2: 'algorand:a' })

        const { result } = renderHook(() => useOnrampScope({ algorand: {} }))

        expect(result.current).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })

    test('is null when the chain has onramp switched off', () => {
        registerFakeChain({
            chainId: 'algorand',
            caip2: 'algorand:a',
            onramp: false,
        })

        const { result } = renderHook(() => useOnrampScope({ algorand: {} }))

        expect(result.current).toBeNull()
    })

    test('is null without an account', () => {
        registerFakeChain({ chainId: 'algorand', caip2: 'algorand:a' })

        const { result } = renderHook(() => useOnrampScope(null))

        expect(result.current).toBeNull()
    })

    test('follows a remote switch of the capability', () => {
        registerFakeChain({ chainId: 'algorand', caip2: 'algorand:a' })
        const { result, rerender } = renderHook(() =>
            useOnrampScope({ algorand: {} }),
        )
        expect(result.current).not.toBeNull()

        act(() => {
            getProvider().chains.setCapabilityOverrides(() => ({
                remote: { algorand: { onramp: false } },
            }))
        })
        rerender()

        expect(result.current).toBeNull()
    })
})
