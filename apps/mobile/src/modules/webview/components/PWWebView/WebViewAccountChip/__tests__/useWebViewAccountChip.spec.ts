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

const mocks = vi.hoisted(() => ({
    connections: [] as unknown[],
    handleChangeAccount: vi.fn(async () => {}),
    useChangeConnectionAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-connections', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-connections')
    >()),
    useConnectionsStore: (
        select: (state: { connections: unknown[] }) => unknown,
    ) => select({ connections: mocks.connections }),
}))

vi.mock('@modules/walletconnect', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/walletconnect')>()),
    useChangeConnectionAccount: mocks.useChangeConnectionAccount,
}))

import { useWebViewAccountChip } from '../useWebViewAccountChip'

const site = (origin: string, accounts = ['0x1']) => ({
    id: `dapp-eip1193:${origin}`,
    kind: 'dapp-eip1193',
    name: origin,
    peer: { name: origin },
    accounts,
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
    metadata: { chainId: 'ethereum' },
    origin: { requesterOrigin: origin },
})

describe('useWebViewAccountChip', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.connections = [site('https://app.uniswap.org')]
        mocks.useChangeConnectionAccount.mockImplementation(
            ({ evmChainIds }: { evmChainIds: string[] }) => ({
                evmChainId: evmChainIds[0],
                activeEvmAccount: null,
                isAvailable: evmChainIds.length > 0,
                isChanging: false,
                handleChangeAccount: mocks.handleChangeAccount,
            }),
        )
    })

    it('offers to change the account of the page’s site', () => {
        const { result } = renderHook(() =>
            useWebViewAccountChip('https://app.uniswap.org/swap?x=1'),
        )

        expect(result.current.isVisible).toBe(true)
        expect(mocks.useChangeConnectionAccount).toHaveBeenLastCalledWith({
            id: 'dapp-eip1193:https://app.uniswap.org',
            accounts: ['0x1'],
            evmChainIds: ['ethereum'],
        })
    })

    it('hides for a site with no in-app browser connection', () => {
        const { result } = renderHook(() =>
            useWebViewAccountChip('https://app.aave.com'),
        )

        expect(result.current.isVisible).toBe(false)
    })

    it('hides for a page with no origin to match', () => {
        const { result } = renderHook(() =>
            useWebViewAccountChip('about:blank'),
        )

        expect(result.current.isVisible).toBe(false)
    })

    it('follows the page to another site', () => {
        mocks.connections = [
            site('https://app.uniswap.org'),
            site('https://app.aave.com', ['0x2']),
        ]
        const { rerender } = renderHook(
            ({ url }) => useWebViewAccountChip(url),
            { initialProps: { url: 'https://app.uniswap.org' } },
        )

        rerender({ url: 'https://app.aave.com/markets' })

        expect(mocks.useChangeConnectionAccount).toHaveBeenLastCalledWith(
            expect.objectContaining({
                id: 'dapp-eip1193:https://app.aave.com',
                accounts: ['0x2'],
            }),
        )
    })

    it('changes the site’s account on press', async () => {
        const { result } = renderHook(() =>
            useWebViewAccountChip('https://app.uniswap.org'),
        )

        await act(() => result.current.handlePress())

        expect(mocks.handleChangeAccount).toHaveBeenCalledTimes(1)
    })
})
