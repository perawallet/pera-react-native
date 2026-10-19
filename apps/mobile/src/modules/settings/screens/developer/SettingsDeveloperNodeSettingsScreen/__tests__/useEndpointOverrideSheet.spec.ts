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
import type { Query } from '@tanstack/react-query'
import {
    nodeEndpointAdapters,
    selectEndpointOverride,
    useNetworkStore,
    type EndpointOverrideCheck,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { useEndpointOverrideSheet } from '../useEndpointOverrideSheet'

const mocks = vi.hoisted(() => ({
    invalidateQueries: vi.fn(),
    restart: vi.fn(),
    checkOverride: vi.fn(),
    endpointUrl: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({ restart: mocks.restart }),
}))

const CONFIGURED = 'https://sepolia.rpc.example'
const OVERRIDE = 'https://my-node.example'

const overrideOf = (networkId: string) =>
    selectEndpointOverride(
        useNetworkStore.getState(),
        ETHEREUM_CHAIN_ID,
        networkId,
    )

const renderSheet = () =>
    renderHook(() =>
        useEndpointOverrideSheet({
            chainId: ETHEREUM_CHAIN_ID,
            networkId: 'sepolia',
        }),
    )

describe('useEndpointOverrideSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStore.getState().resetState()
        getProvider().chains.reset()
        getProvider().chains.register(
            fixtureEthereumDescriptor,
            allCapabilities(false),
        )
        nodeEndpointAdapters.reset()
        nodeEndpointAdapters.register({
            chainId: ETHEREUM_CHAIN_ID,
            endpointUrl: mocks.endpointUrl,
            checkOverride: mocks.checkOverride,
        })
        mocks.endpointUrl.mockImplementation(
            (networkId: string) => overrideOf(networkId) ?? CONFIGURED,
        )
        mocks.checkOverride.mockResolvedValue('matches')
    })

    it('starts empty, naming the network and the host in use', () => {
        const { result } = renderSheet()

        expect(result.current.url).toBe('')
        expect(result.current.hasOverride).toBe(false)
        expect(result.current.networkName).toBe('Ethereum Sepolia')
        expect(result.current.currentHost).toBe('sepolia.rpc.example')
    })

    it('seeds the draft from a saved override', () => {
        useNetworkStore
            .getState()
            .setEndpointOverride(ETHEREUM_CHAIN_ID, 'sepolia', OVERRIDE)

        const { result } = renderSheet()

        expect(result.current.url).toBe(OVERRIDE)
        expect(result.current.hasOverride).toBe(true)
    })

    it('refuses an invalid URL without asking the node', async () => {
        const { result } = renderSheet()
        act(() => result.current.handleUrlChange('ftp://nope'))

        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(false)
        expect(result.current.error).toBe('invalid-url')
        expect(mocks.checkOverride).not.toHaveBeenCalled()
    })

    it.each<EndpointOverrideCheck>(['wrong-network', 'unreachable'])(
        'keeps the configured endpoint when the check reports %s',
        async check => {
            mocks.checkOverride.mockResolvedValue(check)
            const { result } = renderSheet()
            act(() => result.current.handleUrlChange(OVERRIDE))

            let saved: boolean | undefined
            await act(async () => {
                saved = await result.current.handleSave()
            })

            expect(saved).toBe(false)
            expect(result.current.error).toBe(check)
            expect(result.current.isChecking).toBe(false)
            expect(overrideOf('sepolia')).toBeUndefined()
            expect(mocks.restart).not.toHaveBeenCalled()
        },
    )

    it('clears the error once the URL is edited', async () => {
        mocks.checkOverride.mockResolvedValue('wrong-network')
        const { result } = renderSheet()
        act(() => result.current.handleUrlChange(OVERRIDE))
        await act(async () => {
            await result.current.handleSave()
        })

        act(() => result.current.handleUrlChange('https://other.example'))

        expect(result.current.error).toBeUndefined()
    })

    it('shows the check in progress', async () => {
        let finish: (value: EndpointOverrideCheck) => void = () => {}
        mocks.checkOverride.mockReturnValue(
            new Promise<EndpointOverrideCheck>(resolve => {
                finish = resolve
            }),
        )
        const { result } = renderSheet()
        act(() => result.current.handleUrlChange(OVERRIDE))

        let pending: Promise<boolean> = Promise.resolve(false)
        act(() => {
            pending = result.current.handleSave()
        })
        expect(result.current.isChecking).toBe(true)

        await act(async () => {
            finish('matches')
            await pending
        })
        expect(result.current.isChecking).toBe(false)
    })

    it('saves nothing when the sheet is dismissed before the check answers', async () => {
        let finish: (value: EndpointOverrideCheck) => void = () => {}
        mocks.checkOverride.mockReturnValue(
            new Promise<EndpointOverrideCheck>(resolve => {
                finish = resolve
            }),
        )
        const { result, unmount } = renderSheet()
        act(() => result.current.handleUrlChange(OVERRIDE))
        let pending: Promise<boolean> = Promise.resolve(true)
        act(() => {
            pending = result.current.handleSave()
        })

        unmount()
        finish('matches')

        await expect(pending).resolves.toBe(false)
        expect(overrideOf('sepolia')).toBeUndefined()
        expect(mocks.restart).not.toHaveBeenCalled()
    })

    it('saves nothing for a chain that accepts no override', async () => {
        nodeEndpointAdapters.reset()
        nodeEndpointAdapters.register({
            chainId: ETHEREUM_CHAIN_ID,
            endpointUrl: mocks.endpointUrl,
        })
        const { result } = renderSheet()
        act(() => result.current.handleUrlChange(OVERRIDE))

        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(false)
        expect(result.current.error).toBeUndefined()
        expect(overrideOf('sepolia')).toBeUndefined()
    })

    it('saves a matching URL, trimmed, for that network only, then refreshes the network', async () => {
        const { result } = renderSheet()
        act(() => result.current.handleUrlChange(`  ${OVERRIDE}  `))

        let saved: boolean | undefined
        await act(async () => {
            saved = await result.current.handleSave()
        })

        expect(saved).toBe(true)
        expect(mocks.checkOverride).toHaveBeenCalledWith('sepolia', OVERRIDE)
        expect(useNetworkStore.getState().endpointOverridesByChain).toEqual({
            [ETHEREUM_CHAIN_ID]: { sepolia: OVERRIDE },
        })
        expect(result.current.currentHost).toBe('my-node.example')
        expect(mocks.restart).toHaveBeenCalledOnce()

        const { predicate } = mocks.invalidateQueries.mock.calls[0][0] as {
            predicate: (query: Pick<Query, 'queryKey'>) => boolean
        }
        expect(
            predicate({
                queryKey: [
                    'balances',
                    { chainId: ETHEREUM_CHAIN_ID, networkId: 'sepolia' },
                ],
            }),
        ).toBe(true)
        expect(
            predicate({
                queryKey: [
                    'balances',
                    { chainId: ETHEREUM_CHAIN_ID, networkId: 'mainnet' },
                ],
            }),
        ).toBe(false)
    })

    it('reset restores the configured endpoint', () => {
        useNetworkStore
            .getState()
            .setEndpointOverride(ETHEREUM_CHAIN_ID, 'sepolia', OVERRIDE)
        const { result } = renderSheet()

        act(() => result.current.handleReset())

        expect(overrideOf('sepolia')).toBeUndefined()
        expect(result.current.hasOverride).toBe(false)
        expect(result.current.currentHost).toBe('sepolia.rpc.example')
        expect(mocks.restart).toHaveBeenCalledOnce()
    })
})
