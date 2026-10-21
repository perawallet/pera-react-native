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
import { act, renderHook } from '@testing-library/react'
import { useSendToContact } from '../useSendToContact'

const mocks = vi.hoisted(() => ({
    chains: [] as { id: string; family: string }[],
    capable: new Set<string>(),
    resolutions: {} as Record<string, unknown>,
    request: vi.fn(),
    requestByType: vi.fn(),
    pickSender: vi.fn(),
    setSelectedAccountId: vi.fn(),
    sendStore: {
        reset: vi.fn(),
        setDestination: vi.fn(),
        setSelectedAsset: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: { list: () => mocks.chains } }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: Object.assign(
        (select: (state: { accounts: unknown[] }) => unknown) =>
            select({ accounts: [] }),
        {
            getState: () => ({
                setSelectedAccountId: mocks.setSelectedAccountId,
            }),
        },
    ),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    findNativeAsset: (chainId: string) => ({ assetId: `${chainId}-native` }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck:
        () =>
        ({ chain }: { chain: { chainId: string } }) =>
            mocks.capable.has(chain.chainId),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.request,
        requestByType: mocks.requestByType,
    }),
}))

vi.mock('@modules/transactions', () => ({
    useSendAccountResolver: () => ({
        resolve: (chainId: string) =>
            mocks.resolutions[chainId] ?? { kind: 'none' },
        pick: mocks.pickSender,
    }),
    useSendFundsStore: { getState: () => mocks.sendStore },
}))

vi.mock('../../components/ContactSendNetworkContent', () => ({
    ContactSendNetworkContent: () => null,
}))

const SENDER = { id: 'sender-1' }

describe('useSendToContact', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.chains = [
            { id: 'algorand', family: 'algorand' },
            { id: 'ethereum', family: 'evm' },
            { id: 'base', family: 'evm' },
        ]
        mocks.capable = new Set(['algorand', 'ethereum', 'base'])
        mocks.resolutions = {
            algorand: { kind: 'selected', account: SENDER },
            ethereum: { kind: 'single', account: SENDER },
            base: { kind: 'single', account: SENDER },
        }
    })

    it('can send on a family only where an account can send on one of its networks', () => {
        mocks.resolutions = { algorand: { kind: 'selected', account: SENDER } }
        const { result } = renderHook(() => useSendToContact())

        expect(result.current.canSendOn('algorand')).toBe(true)
        expect(result.current.canSendOn('evm')).toBe(false)
    })

    it('opens Send to the address on the only network of its family, pinned by its native asset', async () => {
        const { result } = renderHook(() => useSendToContact())

        await act(() => result.current.sendTo('algorand', 'ALGO_ADDR'))

        expect(mocks.request).not.toHaveBeenCalled()
        expect(mocks.setSelectedAccountId).toHaveBeenCalledWith('sender-1')
        expect(mocks.sendStore.reset).toHaveBeenCalled()
        expect(mocks.sendStore.setDestination).toHaveBeenCalledWith('ALGO_ADDR')
        expect(mocks.sendStore.setSelectedAsset).toHaveBeenCalledWith({
            chainId: 'algorand',
            assetId: 'algorand-native',
        })
        expect(mocks.requestByType).toHaveBeenCalledWith(
            'send-funds',
            {},
            expect.anything(),
        )
    })

    it('asks which network for an EVM address, offering only the ones the user can send on', async () => {
        mocks.capable.delete('base')
        mocks.chains.push({ id: 'polygon', family: 'evm' })
        mocks.capable.add('polygon')
        mocks.resolutions.polygon = { kind: 'single', account: SENDER }
        mocks.request.mockResolvedValue('polygon')
        const { result } = renderHook(() => useSendToContact())

        await act(() => result.current.sendTo('evm', '0xB0B'))

        const [{ contents }] = mocks.request.mock.calls[0]!
        expect(contents.props).toEqual({ chainIds: ['ethereum', 'polygon'] })
        expect(mocks.sendStore.setSelectedAsset).toHaveBeenCalledWith({
            chainId: 'polygon',
            assetId: 'polygon-native',
        })
    })

    it('opens nothing when the network sheet is dismissed', async () => {
        mocks.request.mockResolvedValue(undefined)
        const { result } = renderHook(() => useSendToContact())

        await act(() => result.current.sendTo('evm', '0xB0B'))

        expect(mocks.requestByType).not.toHaveBeenCalled()
    })

    it('asks which account sends when several can, and opens nothing if none is picked', async () => {
        mocks.resolutions.algorand = {
            kind: 'picker',
            accounts: [SENDER, { id: 'sender-2' }],
        }
        mocks.pickSender.mockResolvedValue(undefined)
        const { result } = renderHook(() => useSendToContact())

        await act(() => result.current.sendTo('algorand', 'ALGO_ADDR'))

        expect(mocks.pickSender).toHaveBeenCalledWith('algorand', [
            SENDER,
            { id: 'sender-2' },
        ])
        expect(mocks.requestByType).not.toHaveBeenCalled()
    })
})
