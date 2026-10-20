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
    setSelectedChainId: vi.fn(),
    options: [] as { chainId: string; isEnabled: boolean }[],
}))

const account = {
    id: 'hd',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { ethereum: { address: '0xabc', keyPairId: 'k' } },
}

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: () => () => mocks.options,
    useEnableChain: () => mocks.enableChain,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ ethereum: 'Ethereum', base: 'Base' })[chainId],
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: () => ({
        selectedAccount: account,
        setSelectedAccount: mocks.setSelectedAccount,
        setSelectedChainId: mocks.setSelectedChainId,
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
            { chainId: 'ethereum', isEnabled: true },
            { chainId: 'base', isEnabled: false },
        ]
    })

    it('lists the chains in the order the account offers them, with their names', () => {
        const { result } = renderHook(() => useChainSelectionScreen())

        expect(result.current.rows).toEqual([
            { chainId: 'ethereum', isEnabled: true, displayName: 'Ethereum' },
            { chainId: 'base', isEnabled: false, displayName: 'Base' },
        ])
    })

    it('opens the QR for an enabled chain without enabling anything', () => {
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleSelectChain('ethereum' as ChainId))

        expect(mocks.enableChain).not.toHaveBeenCalled()
        expect(mocks.setSelectedChainId).toHaveBeenCalledWith('ethereum')
        expect(mocks.navigate).toHaveBeenCalledWith('QRView')
    })

    it('enables an eligible chain for the account, then opens its QR', async () => {
        const enabled = {
            ...account,
            chains: { ...account.chains, base: { address: '0xabc' } },
        }
        mocks.enableChain.mockResolvedValue(enabled)
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => result.current.handleSelectChain('base' as ChainId))

        expect(result.current.enablingChainId).toBe('base')
        await waitFor(() =>
            expect(mocks.navigate).toHaveBeenCalledWith('QRView'),
        )
        expect(mocks.enableChain).toHaveBeenCalledExactlyOnceWith(
            'hd',
            'base',
            'user',
        )
        expect(mocks.setSelectedAccount).toHaveBeenCalledWith(enabled)
        expect(mocks.setSelectedChainId).toHaveBeenCalledWith('base')
        expect(result.current.enablingChainId).toBeUndefined()
    })

    it('enables once when the chain is tapped twice', async () => {
        mocks.enableChain.mockResolvedValue(account)
        const { result } = renderHook(() => useChainSelectionScreen())

        act(() => {
            result.current.handleSelectChain('base' as ChainId)
            result.current.handleSelectChain('base' as ChainId)
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

        act(() => result.current.handleSelectChain('base' as ChainId))

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
