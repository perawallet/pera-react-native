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
import { act, renderHook, waitFor } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useAccountChainSelection } from '../useAccountChainSelection'

const mocks = vi.hoisted(() => ({
    enableChain: vi.fn(),
    showError: vi.fn(),
    resolverCapability: vi.fn(),
    options: [] as {
        chainId: string
        isEnabled: boolean
        address?: string
    }[],
}))

const account = {
    id: 'hd',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        algorand: { address: 'ALGOADDR', keyPairId: 'a' },
        ethereum: { address: '0xabc', keyPairId: 'k' },
    },
} as unknown as WalletAccount

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: (capability: string) => {
        mocks.resolverCapability(capability)
        return () => mocks.options
    },
    useEnableChain: () => mocks.enableChain,
}))

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    addressCodecs: {
        get: (chainId: string) => ({
            truncate: (address: string) => `${chainId}:${address}`,
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ algorand: 'Algorand', ethereum: 'Ethereum', base: 'Base' })[chainId],
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

describe('useAccountChainSelection', () => {
    const onSelectChain = vi.fn()
    const onChainEnabled = vi.fn()

    const renderSelection = (selectedAccount?: WalletAccount) =>
        renderHook(() =>
            useAccountChainSelection({
                account: selectedAccount,
                capability: 'send',
                onSelectChain,
                onChainEnabled,
            }),
        )

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.options = [
            { chainId: 'algorand', isEnabled: true, address: 'ALGOADDR' },
            { chainId: 'base', isEnabled: false, address: '0xabc' },
        ]
    })

    it('lists the chains the capability offers, with their names and truncated addresses', () => {
        const { result } = renderSelection(account)

        expect(mocks.resolverCapability).toHaveBeenCalledWith('send')
        expect(result.current.rows).toEqual([
            {
                chainId: 'algorand',
                isEnabled: true,
                displayName: 'Algorand',
                address: 'algorand:ALGOADDR',
            },
            {
                chainId: 'base',
                isEnabled: false,
                displayName: 'Base',
                address: 'base:0xabc',
            },
        ])
    })

    it('lists nothing without an account', () => {
        const { result } = renderSelection()

        expect(result.current.rows).toEqual([])
    })

    it('selects an enabled chain', () => {
        const { result } = renderSelection(account)

        act(() => result.current.handleSelectChain('algorand' as ChainId))

        expect(onSelectChain).toHaveBeenCalledExactlyOnceWith('algorand')
        expect(mocks.enableChain).not.toHaveBeenCalled()
    })

    it('does not select a chain that still has to be added', () => {
        const { result } = renderSelection(account)

        act(() => result.current.handleSelectChain('base' as ChainId))

        expect(onSelectChain).not.toHaveBeenCalled()
    })

    it('adds an eligible chain and hands back the account that holds it, without selecting it', async () => {
        const enabled = { ...account, id: 'hd-with-base' }
        mocks.enableChain.mockResolvedValue(enabled)
        const { result } = renderSelection(account)

        act(() => result.current.handleAddChain('base' as ChainId))

        expect(result.current.enablingChainId).toBe('base')
        await waitFor(() =>
            expect(onChainEnabled).toHaveBeenCalledWith(enabled),
        )
        expect(mocks.enableChain).toHaveBeenCalledExactlyOnceWith(
            'hd',
            'base',
            'user',
        )
        expect(onSelectChain).not.toHaveBeenCalled()
    })

    it('does not add a chain the account already holds', () => {
        const { result } = renderSelection(account)

        act(() => result.current.handleAddChain('algorand' as ChainId))

        expect(mocks.enableChain).not.toHaveBeenCalled()
    })
})
