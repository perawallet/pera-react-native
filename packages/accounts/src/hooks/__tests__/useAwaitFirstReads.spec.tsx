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

// @vitest-environment jsdom
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ensureAccountFetched } from '../../sync/account-syncer'
import { useHoldingsRefreshStore } from '../../store/holdingsRefresh'
import { getAccountHoldingsPageQueryKey } from '../querykeys'
import { readFirstReadWaitMs, useAwaitFirstReads } from '../useAwaitFirstReads'

vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGO_SOURCE = { address: 'ADDR1', scope: ALGORAND }
const ETH_SOURCE = { address: '0xADDR', scope: ETHEREUM }
const LIST_KEY = getAccountHoldingsPageQueryKey([ALGO_SOURCE, ETH_SOURCE])
const WAIT_MS = 20

const remoteNumber = () => vi.mocked(getProvider().remoteConfig.getNumberValue)

const setUp = () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(LIST_KEY, [])
    const { result } = renderHook(() => useAwaitFirstReads('holdings-page'), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            ),
    })
    const isListInvalidated = () =>
        queryClient.getQueryState(LIST_KEY)?.isInvalidated === true
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    return { awaitFirstReads: result.current, isListInvalidated, invalidate }
}

// Holds the Ethereum read open until the test lands it.
const holdEthereumRead = () => {
    let land: () => void = () => {}
    vi.mocked(ensureAccountFetched).mockImplementation(address =>
        address === ETH_SOURCE.address
            ? new Promise<void>(resolve => {
                  land = resolve
              })
            : Promise.resolve(),
    )
    return () => act(() => land())
}

const markEthereumFailed = (hasFailed: boolean) =>
    useHoldingsRefreshStore
        .getState()
        .setHoldingsRefreshFailed(ETHEREUM, ETH_SOURCE.address, hasFailed)

const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

describe('readFirstReadWaitMs', () => {
    afterEach(() => {
        remoteNumber().mockImplementation((_key, fallback) => fallback ?? 0)
    })

    it('reads the wait from remote config, defaulting to the bundled value', () => {
        expect(readFirstReadWaitMs()).toBe(3000)

        remoteNumber().mockReturnValue(5000)

        expect(readFirstReadWaitMs()).toBe(5000)
    })

    it.each([0, -1, Number.NaN])(
        'falls back to the bundled wait for an unusable value of %s',
        value => {
            remoteNumber().mockReturnValue(value)

            expect(readFirstReadWaitMs()).toBe(3000)
        },
    )
})

describe('useAwaitFirstReads', () => {
    beforeEach(() => {
        useHoldingsRefreshStore.getState().resetState()
        remoteNumber().mockReturnValue(WAIT_MS)
    })

    afterEach(() => {
        remoteNumber().mockImplementation((_key, fallback) => fallback ?? 0)
        vi.mocked(ensureAccountFetched).mockImplementation(() =>
            Promise.resolve(),
        )
    })

    it('waits for every first read that lands in time', async () => {
        const { awaitFirstReads, isListInvalidated } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])

        expect(ensureAccountFetched).toHaveBeenCalledTimes(2)
        expect(isListInvalidated()).toBe(false)
    })

    it('stops waiting on a slow read, and re-reads the list once it lands', async () => {
        const land = holdEthereumRead()
        const { awaitFirstReads, isListInvalidated } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        expect(isListInvalidated()).toBe(false)

        await land()
        await settle()

        expect(isListInvalidated()).toBe(true)
    })

    it('asks a failed chain again without waiting on it, and re-reads the list when that read succeeds', async () => {
        markEthereumFailed(true)
        const land = holdEthereumRead()
        const { awaitFirstReads, isListInvalidated } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        expect(ensureAccountFetched).toHaveBeenCalledWith(
            ETH_SOURCE.address,
            ETHEREUM,
        )

        markEthereumFailed(false)
        await land()
        await settle()

        expect(isListInvalidated()).toBe(true)
    })

    it('fails the wait when a read rejects within the deadline', async () => {
        vi.mocked(ensureAccountFetched).mockImplementation(address =>
            address === ETH_SOURCE.address
                ? Promise.reject(new Error('database is locked'))
                : Promise.resolve(),
        )
        const { awaitFirstReads } = setUp()

        await expect(
            awaitFirstReads([ALGO_SOURCE, ETH_SOURCE]),
        ).rejects.toThrow('database is locked')
    })

    it('leaves no unhandled rejection when a read it stopped waiting on rejects later', async () => {
        let reject: (error: Error) => void = () => {}
        vi.mocked(ensureAccountFetched).mockImplementation(address =>
            address === ETH_SOURCE.address
                ? new Promise<void>((_, fail) => {
                      reject = fail
                  })
                : Promise.resolve(),
        )
        const { awaitFirstReads, isListInvalidated } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        await act(() => reject(new Error('database is locked')))
        await settle()

        expect(isListInvalidated()).toBe(false)
    })

    it('leaves no unhandled rejection when the retried read of a failed chain rejects', async () => {
        markEthereumFailed(true)
        vi.mocked(ensureAccountFetched).mockImplementation(address =>
            address === ETH_SOURCE.address
                ? Promise.reject(new Error('database is locked'))
                : Promise.resolve(),
        )
        const { awaitFirstReads, invalidate } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        await settle()

        expect(invalidate).not.toHaveBeenCalled()
    })

    it('re-reads the list once, not on every read, for a chain that keeps failing', async () => {
        markEthereumFailed(true)
        const { awaitFirstReads, invalidate } = setUp()

        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        await settle()
        await awaitFirstReads([ALGO_SOURCE, ETH_SOURCE])
        await settle()

        expect(invalidate).toHaveBeenCalledOnce()
    })
})
