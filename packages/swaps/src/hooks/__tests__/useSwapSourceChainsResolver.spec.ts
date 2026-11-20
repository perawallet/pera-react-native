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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapSourceChainsResolver } from '../useSwapSourceChainsResolver'

const mocks = vi.hoisted(() => ({
    resolver: vi.fn(),
    optionsOf: vi.fn(() => [
        { chainId: 'algorand', isEnabled: true },
        { chainId: 'ethereum', isEnabled: false },
        { chainId: 'base', isEnabled: true },
    ]),
    scopes: ['algorand', 'ethereum', 'base'].map(chainId => ({
        chainId,
        networkId: 'mainnet',
    })),
    unbackedChainIds: [] as string[],
    refusalsVersion: 0,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: (...args: unknown[]) => {
        mocks.resolver(...args)
        return mocks.optionsOf
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScopes: () => mocks.scopes,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    hasPeraBackend: ({ chainId }: { chainId: string }) =>
        !mocks.unbackedChainIds.includes(chainId),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-device')
    >()),
    usePeraScopeRefusalsVersion: () => mocks.refusalsVersion,
}))

const ACCOUNT = { id: 'account' } as unknown as WalletAccount

describe('swaps/useSwapSourceChainsResolver', () => {
    beforeEach(() => {
        mocks.unbackedChainIds = []
        mocks.refusalsVersion = 0
    })

    test('asks only for chains the account can sign a swap on, keeping the enabled ones', () => {
        const { result } = renderHook(() => useSwapSourceChainsResolver())

        expect(result.current(ACCOUNT)).toEqual(['algorand', 'base'])
        expect(mocks.resolver).toHaveBeenCalledWith('swap', {
            isSignerRequired: true,
        })
    })

    test('drops a chain with no Pera backend at its selected network', () => {
        mocks.unbackedChainIds = ['base']
        const { result } = renderHook(() => useSwapSourceChainsResolver())

        expect(result.current(ACCOUNT)).toEqual(['algorand'])
    })

    test('re-reads the backend gate when a scope is refused', () => {
        const { result, rerender } = renderHook(() =>
            useSwapSourceChainsResolver(),
        )
        expect(result.current(ACCOUNT)).toEqual(['algorand', 'base'])

        mocks.unbackedChainIds = ['algorand']
        mocks.refusalsVersion = 1
        rerender()

        expect(result.current(ACCOUNT)).toEqual(['base'])
    })

    test('updates eligibility when the backend switch changes without a scope change or refusal', () => {
        const { result, rerender } = renderHook(() =>
            useSwapSourceChainsResolver(),
        )
        const initialResolver = result.current
        expect(initialResolver(ACCOUNT)).toEqual(['algorand', 'base'])

        rerender()
        expect(result.current).toBe(initialResolver)

        mocks.unbackedChainIds = ['base']
        rerender()
        expect(result.current(ACCOUNT)).toEqual(['algorand'])
    })
})
