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
import { renderHook } from '@testing-library/react'
import { useWidgetReceiveTargets } from '../useWidgetReceiveTargets'

const state = vi.hoisted(() => ({
    accounts: [] as { id: string; chain?: string }[],
    receiveTargetOf: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => state.accounts,
    useCapabilityChainResolver:
        () =>
        (account: { chain?: string }): string | undefined =>
            account.chain,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        networks: [{ id: `${chainId}-net`, caip2: `caip2:${chainId}` }],
    }),
    useNetworkStore: (selector: (s: unknown) => unknown) =>
        selector({ mode: 'live' }),
    selectChainNetworkId: (_state: unknown, chainId: string) =>
        `${chainId}-net`,
}))

vi.mock('@utils/receiveTarget', () => ({
    receiveTargetOf: (...args: unknown[]) => state.receiveTargetOf(...args),
}))

describe('useWidgetReceiveTargets', () => {
    beforeEach(() => {
        state.receiveTargetOf.mockReset()
        state.receiveTargetOf.mockImplementation(
            (account: { id: string }, scope: unknown) =>
                scope
                    ? {
                          accountName: `name:${account.id}`,
                          address: `addr:${account.id}`,
                          paymentUri: `uri:${account.id}`,
                      }
                    : null,
        )
    })

    it('resolves each account on its receive chain at that chain network', () => {
        state.accounts = [
            { id: 'a', chain: 'algorand' },
            { id: 'e', chain: 'ethereum' },
        ]

        const { result } = renderHook(() => useWidgetReceiveTargets())

        expect(state.receiveTargetOf).toHaveBeenCalledWith(state.accounts[1], {
            chainId: 'ethereum',
            networkId: 'ethereum-net',
        })
        expect(result.current).toEqual([
            {
                address: 'addr:a',
                name: 'name:a',
                paymentUri: 'uri:a',
                chain: 'caip2:algorand',
            },
            {
                address: 'addr:e',
                name: 'name:e',
                paymentUri: 'uri:e',
                chain: 'caip2:ethereum',
            },
        ])
    })

    it('leaves out accounts that cannot receive', () => {
        state.accounts = [{ id: 'a', chain: 'algorand' }, { id: 'none' }]

        const { result } = renderHook(() => useWidgetReceiveTargets())

        expect(result.current.map(target => target.address)).toEqual(['addr:a'])
    })
})
