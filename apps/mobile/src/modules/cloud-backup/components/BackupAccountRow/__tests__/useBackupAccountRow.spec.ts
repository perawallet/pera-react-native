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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useBackupAccountRow } from '../useBackupAccountRow'

const state = vi.hoisted(() => ({
    isMultichain: true,
    registered: ['algorand', 'ethereum', 'base'],
    switchedOff: [] as string[],
}))

vi.mock('@modules/accounts', () => ({
    useIsMultichain: () => state.isMultichain,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useRegisteredChainIds: () => state.registered,
    accountChainOptions: (
        account: { chains: Record<string, { address: string }> },
        isOn: (chainId: string) => boolean,
    ) =>
        state.registered.filter(isOn).map(chainId => ({
            chainId,
            isEnabled: account.chains[chainId] !== undefined,
            address: account.chains[chainId]?.address,
        })),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSwitchedOffChainIds: () => state.switchedOff,
}))

vi.mock('@utils/chainOptionDisplay', () => ({
    displayChainOption: (option: { chainId: string; address?: string }) => ({
        ...option,
        displayName: option.chainId.toUpperCase(),
        address: option.address && `short:${option.address}`,
    }),
    chainAddressCopyValue: (_chainId: string, address: string) =>
        `copy:${address}`,
}))

const HD_ACCOUNT = {
    id: 'hd',
    chains: {
        algorand: { address: 'ALGO' },
        ethereum: { address: '0xeth' },
        base: { address: '0xeth' },
    },
} as unknown as WalletAccount

describe('useBackupAccountRow', () => {
    beforeEach(() => {
        state.isMultichain = true
        state.registered = ['algorand', 'ethereum', 'base']
        state.switchedOff = []
    })

    it("lists every network a device account is on, with each one's address", () => {
        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'ALGO', account: HD_ACCOUNT }),
        )

        expect(result.current.chainIds).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
        expect(result.current.chains[1]).toEqual({
            chainId: 'ethereum',
            displayName: 'ETHEREUM',
            address: 'short:0xeth',
            copyValue: 'copy:0xeth',
        })
    })

    it('leaves out a network that is switched off', () => {
        state.switchedOff = ['base']

        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'ALGO', account: HD_ACCOUNT }),
        )

        expect(result.current.chainIds).toEqual(['algorand', 'ethereum'])
    })

    it('lists only Algorand for an account on Algorand alone', () => {
        const ledger = {
            id: 'ledger',
            chains: { algorand: { address: 'LEDGER' } },
        } as unknown as WalletAccount

        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'LEDGER', account: ledger }),
        )

        expect(result.current.chainIds).toEqual(['algorand'])
    })

    it("lists a backup-only account's networks from its record, in registry order, skipping one this build doesn't know", () => {
        const { result } = renderHook(() =>
            useBackupAccountRow({
                address: 'ALGO',
                backupChains: [
                    { chain: 'base', address: '0xeth' },
                    { chain: 'algorand', address: 'ALGO' },
                    { chain: 'solana', address: 'SOL' },
                ],
            }),
        )

        expect(result.current.chainIds).toEqual(['algorand', 'base'])
        expect(result.current.chains[1]?.copyValue).toBe('copy:0xeth')
    })

    it('treats a backup-only item from before records as Algorand', () => {
        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'OLD', backupChains: [] }),
        )

        expect(result.current.chains).toEqual([
            expect.objectContaining({
                chainId: 'algorand',
                copyValue: 'copy:OLD',
            }),
        ])
    })

    it('expands and collapses on toggle', () => {
        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'ALGO', account: HD_ACCOUNT }),
        )

        expect(result.current.canExpand).toBe(true)
        act(() => result.current.onToggle())
        expect(result.current.isExpanded).toBe(true)
        act(() => result.current.onToggle())
        expect(result.current.isExpanded).toBe(false)
    })

    it('never expands with one network active, so the row keeps its single-chain layout', () => {
        state.isMultichain = false

        const { result } = renderHook(() =>
            useBackupAccountRow({ address: 'ALGO', account: HD_ACCOUNT }),
        )

        expect(result.current.canExpand).toBe(false)
        act(() => result.current.onToggle())
        expect(result.current.isExpanded).toBe(false)
    })
})
