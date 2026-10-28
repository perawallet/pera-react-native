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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    COLLAPSED_NETWORK_COUNT,
    useAccountNetworks,
} from '../useAccountNetworks'

type Option = { chainId: string; isEnabled: boolean; address?: string }

const mocks = vi.hoisted(() => ({
    accounts: [] as unknown[],
    options: [] as Option[],
    accountChainOptions: vi.fn(),
    unreachableChainsNoteOf: vi.fn(),
    enableChain: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
    copyToClipboard: vi.fn(),
    trackEvent: vi.fn(),
    switchedOff: [] as string[],
    receiveOff: new Set<string>(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    accountChainOptions: (...args: unknown[]) =>
        mocks.accountChainOptions(...args),
    unreachableChainsNoteOf: (...args: unknown[]) =>
        mocks.unreachableChainsNoteOf(...args),
    useAllAccounts: () => mocks.accounts,
    useEnableChain: () => mocks.enableChain,
}))

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    addressCodecs: {
        get: (chainId: string) => ({
            truncate: (address: string) => `${chainId}:${address}`,
            normalize: (address: string) => address.toUpperCase(),
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ algorand: 'Algorand', ethereum: 'Ethereum' })[chainId],
    useChainCapabilityCheck:
        () =>
        ({ chain }: { chain: { chainId: string } }) =>
            !mocks.receiveOff.has(chain.chainId),
    useSwitchedOffChainIds: () => mocks.switchedOff,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            list: () => [
                { id: 'algorand' },
                { id: 'ethereum' },
                { id: 'base' },
            ],
            get: (chainId: string) => ({
                descriptor: {
                    family: chainId === 'algorand' ? 'algorand' : 'evm',
                },
            }),
        },
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { network?: string }) =>
            options?.network ? `${key}:${options.network}` : key,
    }),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    ...(await vi.importActual<object>('@analytics/events/metadata-keys')),
    trackEvent: mocks.trackEvent,
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

const account = {
    id: 'hd',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: 'algoaddr', keyPairId: 'a' } },
} as WalletAccount

const ALGORAND = { chainId: 'algorand', isEnabled: true, address: 'algoaddr' }
const ETHEREUM = { chainId: 'ethereum', isEnabled: false }

const render = (onClose = vi.fn(), onShowAddress = vi.fn()) =>
    renderHook(() => useAccountNetworks({ account, onClose, onShowAddress }))

describe('useAccountNetworks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts = [account]
        mocks.options = [ALGORAND]
        mocks.switchedOff = []
        mocks.receiveOff.clear()
        mocks.accountChainOptions.mockImplementation(() => mocks.options)
        mocks.unreachableChainsNoteOf.mockReturnValue(null)
    })

    it("words the kind's note for the chains that are on but out of the account's reach", () => {
        mocks.unreachableChainsNoteOf.mockReturnValue('kind.unreachable_note')
        mocks.switchedOff = ['base']

        const { result } = render()

        expect(result.current.unreachableChainsNote).toBe(
            'kind.unreachable_note',
        )
        expect(mocks.unreachableChainsNoteOf).toHaveBeenCalledWith(account, [
            'algorand',
            'ethereum',
        ])
    })

    it('shows no note when the account reaches every chain that is on', () => {
        const { result } = render()

        expect(result.current.unreachableChainsNote).toBeNull()
    })

    it("checks the store's current account for the note, not the sheet's snapshot", () => {
        const current = { ...account, chains: { ...account.chains } }
        mocks.accounts = [current]

        render()

        expect(mocks.unreachableChainsNoteOf).toHaveBeenCalledWith(
            current,
            expect.any(Array),
        )
    })

    it('shows an Algorand-only account as one enabled row with its truncated address and QR', () => {
        const { result } = render()

        expect(result.current.visibleRows).toEqual([
            {
                chainId: 'algorand',
                family: 'algorand',
                displayName: 'Algorand',
                address: 'algorand:algoaddr',
                isEnabled: true,
                canShowQr: true,
            },
        ])
        expect(result.current.hiddenRows).toEqual([])
    })

    it('asks for every chain the account can reach, not only its own families', () => {
        render()

        expect(mocks.accountChainOptions).toHaveBeenCalledWith(
            account,
            expect.any(Function),
            'all',
        )
    })

    it('shows an eligible chain as a row to add, without an address', () => {
        mocks.options = [ALGORAND, ETHEREUM]

        const { result } = render()

        expect(result.current.visibleRows[1]).toMatchObject({
            chainId: 'ethereum',
            isEnabled: false,
            address: undefined,
            canShowQr: false,
        })
    })

    it('leaves out a switched-off chain', () => {
        mocks.switchedOff = ['ethereum']

        render()

        const isOn = mocks.accountChainOptions.mock.calls[0][1] as (
            chainId: string,
        ) => boolean
        expect(isOn('ethereum')).toBe(false)
        expect(isOn('algorand')).toBe(true)
    })

    it('shows no QR on a chain whose receive is off', () => {
        mocks.receiveOff.add('algorand')

        const { result } = render()

        expect(result.current.visibleRows[0].canShowQr).toBe(false)
    })

    it('enables a chain for the user and shows it enabled from the store', async () => {
        mocks.options = [ALGORAND, ETHEREUM]
        mocks.enableChain.mockResolvedValue(undefined)
        const { result, rerender } = render()

        act(() => {
            result.current.handleAddNetwork('ethereum' as ChainId)
        })

        expect(result.current.addingChainId).toBe('ethereum')
        await waitFor(() =>
            expect(mocks.enableChain).toHaveBeenCalledWith(
                'hd',
                'ethereum',
                'user',
            ),
        )
        await waitFor(() =>
            expect(result.current.addingChainId).toBeUndefined(),
        )

        const enabled = {
            ...account,
            chains: { ...account.chains, ethereum: { address: '0xabc' } },
        }
        mocks.accounts = [enabled]
        mocks.options = [
            ALGORAND,
            { chainId: 'ethereum', isEnabled: true, address: '0xabc' },
        ]
        rerender()

        expect(result.current.account).toBe(enabled)
        expect(result.current.visibleRows[1]).toMatchObject({
            chainId: 'ethereum',
            isEnabled: true,
            address: 'ethereum:0xabc',
            canShowQr: true,
        })
    })

    it('confirms an added chain with a success toast in the open sheet', async () => {
        mocks.options = [ALGORAND, ETHEREUM]
        mocks.enableChain.mockResolvedValue({ ...account })
        const { result } = render()

        act(() => {
            result.current.handleAddNetwork('ethereum' as ChainId)
        })

        await waitFor(() =>
            expect(mocks.showToast).toHaveBeenCalledWith(
                {
                    title: 'account_options.add_network_success:Ethereum',
                    body: '',
                    type: 'success',
                },
                { notifier: undefined },
            ),
        )
    })

    it('does nothing when Add lands on a chain the account is already on', () => {
        const { result } = render()

        act(() => {
            result.current.handleAddNetwork('algorand' as ChainId)
        })

        expect(mocks.enableChain).not.toHaveBeenCalled()
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('enables once when Add is tapped twice before it settles', async () => {
        mocks.options = [ALGORAND, ETHEREUM]
        mocks.enableChain.mockReturnValue(new Promise(() => {}))
        const { result } = render()

        act(() => {
            result.current.handleAddNetwork('ethereum' as ChainId)
            result.current.handleAddNetwork('ethereum' as ChainId)
        })

        await waitFor(() => expect(mocks.enableChain).toHaveBeenCalledTimes(1))
    })

    it('reports a failed Add and leaves the row to add again', async () => {
        mocks.options = [ALGORAND, ETHEREUM]
        const error = new Error('duplicate')
        mocks.enableChain.mockRejectedValue(error)
        const { result } = render()

        act(() => {
            result.current.handleAddNetwork('ethereum' as ChainId)
        })

        await waitFor(() =>
            expect(mocks.showError).toHaveBeenCalledWith(
                error,
                'account_options.add_network_error',
                { notifier: undefined },
            ),
        )
        await waitFor(() =>
            expect(result.current.addingChainId).toBeUndefined(),
        )
        expect(result.current.visibleRows[1].isEnabled).toBe(false)
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it(`shows ${COLLAPSED_NETWORK_COUNT} rows until all networks are asked for`, () => {
        mocks.options = ['a', 'b', 'c', 'd', 'e'].map(chainId => ({
            chainId,
            isEnabled: false,
        }))
        const { result } = render()

        expect(result.current.visibleRows.map(row => row.chainId)).toEqual([
            'a',
            'b',
            'c',
        ])
        expect(result.current.hiddenRows.map(row => row.chainId)).toEqual([
            'd',
            'e',
        ])

        act(() => {
            result.current.handleShowAllNetworks()
        })

        expect(result.current.visibleRows).toHaveLength(5)
        expect(result.current.hiddenRows).toEqual([])
    })

    it('toggles one expanded chain at a time', () => {
        const { result } = render()

        act(() => {
            result.current.handleToggleExpanded('algorand' as ChainId)
        })
        expect(result.current.expandedChainId).toBe('algorand')

        act(() => {
            result.current.handleToggleExpanded('algorand' as ChainId)
        })
        expect(result.current.expandedChainId).toBeUndefined()
    })

    it("copies the chain's normalized address and closes the sheet", () => {
        const onClose = vi.fn()
        const { result } = render(onClose)

        act(() => {
            result.current.handleCopyAddress('algorand' as ChainId)
        })

        expect(mocks.trackEvent).toHaveBeenCalled()
        expect(mocks.copyToClipboard).toHaveBeenCalledWith('ALGOADDR')
        expect(onClose).toHaveBeenCalled()
    })

    it("closes the sheet, then opens the chain's receive with the store's current account", () => {
        const onClose = vi.fn()
        const onShowAddress = vi.fn()
        const { result } = render(onClose, onShowAddress)

        act(() => {
            result.current.handleShowQr('ethereum' as ChainId)
        })

        expect(onClose).toHaveBeenCalled()
        expect(onShowAddress).toHaveBeenCalledWith(account, 'ethereum')
    })
})
