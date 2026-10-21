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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainSelectionScreen } from '../useChainSelectionScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    enableChain: vi.fn(),
    showError: vi.fn(),
    setSelectedAccount: vi.fn(),
    setChainId: vi.fn(),
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
}

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: () => () => mocks.options,
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

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: () => ({
        selectedAccount: account,
        setSelectedAccount: mocks.setSelectedAccount,
        setChainId: mocks.setChainId,
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

describe('useChainSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.options = [
            { chainId: 'algorand', isEnabled: true, address: 'ALGOADDR' },
            { chainId: 'ethereum', isEnabled: true, address: '0xabc' },
            { chainId: 'base', isEnabled: false, address: '0xabc' },
        ]
    })

    it('lists the chains in the order the account offers them, with their names and truncated addresses', () => {
        const { result } = renderHook(() => useChainSelectionScreen())

        expect(result.current.rows).toEqual([
            {
                chainId: 'algorand',
                isEnabled: true,
                displayName: 'Algorand',
                address: 'algorand:ALGOADDR',
            },
            {
                chainId: 'ethereum',
                isEnabled: true,
                displayName: 'Ethereum',
                address: 'ethereum:0xabc',
            },
            {
                chainId: 'base',
                isEnabled: false,
                displayName: 'Base',
                address: 'base:0xabc',
            },
        ])
    })

    it('leaves the address unset when the account holds none in the family', () => {
        mocks.options = [{ chainId: 'base', isEnabled: false }]
        const { result } = renderHook(() => useChainSelectionScreen())

        expect(result.current.rows[0]?.address).toBeUndefined()
    })

    it('opens the QR for an enabled chain without enabling anything', () => {
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleSelectChain('ethereum' as ChainId))

        expect(mocks.enableChain).not.toHaveBeenCalled()
        expect(mocks.setChainId).toHaveBeenCalledWith('ethereum')
        expect(mocks.navigate).toHaveBeenCalledWith('QRView')
    })

    it('does not open the QR for a chain that still has to be added', () => {
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleSelectChain('base' as ChainId))

        expect(mocks.setChainId).not.toHaveBeenCalled()
        expect(mocks.navigate).not.toHaveBeenCalled()
    })

    it('adds an eligible chain to the account and stays on the list', async () => {
        const enabled = {
            ...account,
            chains: { ...account.chains, base: { address: '0xabc' } },
        }
        mocks.enableChain.mockResolvedValue(enabled)
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleAddChain('base' as ChainId))

        expect(result.current.enablingChainId).toBe('base')
        await waitFor(() =>
            expect(mocks.setSelectedAccount).toHaveBeenCalledWith(enabled),
        )
        expect(mocks.enableChain).toHaveBeenCalledExactlyOnceWith(
            'hd',
            'base',
            'user',
        )
        expect(mocks.setChainId).not.toHaveBeenCalled()
        expect(mocks.navigate).not.toHaveBeenCalled()
        await waitFor(() =>
            expect(result.current.enablingChainId).toBeUndefined(),
        )
    })

    it('enables once when Add is tapped twice', async () => {
        mocks.enableChain.mockResolvedValue(account)
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => {
            result.current.handleAddChain('base' as ChainId)
            result.current.handleAddChain('base' as ChainId)
        })

        await waitFor(() =>
            expect(result.current.enablingChainId).toBeUndefined(),
        )
        expect(mocks.enableChain).toHaveBeenCalledOnce()
    })

    it('shows why and stays when the chain cannot be enabled', async () => {
        const failure = new Error('address held by another account')
        mocks.enableChain.mockRejectedValue(failure)
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleAddChain('base' as ChainId))

        await waitFor(() =>
            expect(mocks.showError).toHaveBeenCalledWith(
                failure,
                'errors.general.title',
                expect.anything(),
            ),
        )
        expect(mocks.navigate).not.toHaveBeenCalled()
    })
})
