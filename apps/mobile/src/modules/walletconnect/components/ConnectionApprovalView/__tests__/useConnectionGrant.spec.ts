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

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

type MockAccount = { id: string; chains: Record<string, { address: string }> }

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    signingAddressesOn: (
        account: MockAccount,
        _accounts: unknown,
        chainIds: readonly string[],
    ) => chainIds.flatMap(chainId => account.chains[chainId]?.address ?? []),
}))

import { useConnectionGrant } from '../useConnectionGrant'

const BOTH = {
    id: 'both',
    chains: { algorand: { address: 'BBBB' }, ethereum: { address: '0xB' } },
}
const ALGO = { id: 'algo', chains: { algorand: { address: 'AAAA' } } }
const EVM = { id: 'evm', chains: { ethereum: { address: '0xE' } } }
const ACCOUNTS = [BOTH, ALGO, EVM] as never[]

type Args = Parameters<typeof useConnectionGrant>[0]
const render = (overrides: Partial<Args> = {}) =>
    renderHook(() =>
        useConnectionGrant({
            accounts: ACCOUNTS,
            chainIds: ['algorand', 'ethereum'],
            evmChainIds: ['ethereum'],
            otherChainIds: ['algorand'],
            requiredChains: undefined,
            evmAccount: EVM as never,
            ...overrides,
        }),
    )

describe('useConnectionGrant', () => {
    it('toggles a checked account back off', () => {
        const { result } = render()

        act(() => result.current.handleAccountPress('algo'))
        act(() => result.current.handleAccountPress('algo'))

        expect(result.current.selectedAccounts).toEqual([])
    })

    // A checked account answers on the other chains only: its EVM address
    // is not granted beside the EVM row's.
    it('grants the EVM account on EVM chains and checked accounts on the rest', () => {
        const { result } = render()

        act(() => result.current.handleAccountPress('both'))

        expect(result.current.grantedAddresses).toEqual(['0xE', 'BBBB'])
        expect(result.current.canConnect).toBe(true)
    })

    it('blocks Connect while a required EVM chain has no account', () => {
        const { result } = render({
            evmAccount: null,
            requiredChains: ['ethereum'],
        })

        act(() => result.current.handleAccountPress('algo'))

        expect(result.current.canConnect).toBe(false)
    })

    it('connects on the other chains when the EVM chain is optional', () => {
        const { result } = render({ evmAccount: null })

        act(() => result.current.handleAccountPress('algo'))

        expect(result.current.grantedAddresses).toEqual(['AAAA'])
        expect(result.current.canConnect).toBe(true)
    })

    it('blocks Connect while a required other chain has no checked account', () => {
        const { result } = render({ requiredChains: ['algorand'] })

        expect(result.current.canConnect).toBe(false)
    })

    it('connects a proposal naming no chain once an account is checked', () => {
        const { result } = render({
            chainIds: [],
            evmChainIds: [],
            otherChainIds: [],
            evmAccount: null,
        })
        expect(result.current.canConnect).toBe(false)

        act(() => result.current.handleAccountPress('algo'))

        expect(result.current.canConnect).toBe(true)
        expect(result.current.grantedAddresses).toEqual([])
    })
})
