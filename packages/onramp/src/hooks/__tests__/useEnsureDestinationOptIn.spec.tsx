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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const {
    optInMock,
    accountInformationMock,
    getSuggestedParamsMock,
    buildMock,
    newGroupMock,
    submitWithFeeDelegationMock,
    useMinimumFeeConfigMock,
} = vi.hoisted(() => {
    const addAssetOptIn = vi.fn()
    const build = vi.fn()
    return {
        optInMock: vi.fn(),
        accountInformationMock: vi.fn(),
        getSuggestedParamsMock: vi.fn(),
        buildMock: build,
        newGroupMock: vi.fn(() => ({ addAssetOptIn, build })),
        submitWithFeeDelegationMock: vi.fn(),
        useMinimumFeeConfigMock: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({
        optIn: optInMock,
        isLoading: false,
        isError: false,
        error: null,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: () => ({ do: accountInformationMock }),
            },
        },
        getSuggestedParams: getSuggestedParamsMock,
        newGroup: newGroupMock,
    }),
    useMinimumFeeConfig: () => useMinimumFeeConfigMock(),
}))

vi.mock('@perawallet/wallet-core-fee-delegation', () => ({
    useFeeDelegation: () => ({
        submitWithFeeDelegation: submitWithFeeDelegationMock,
    }),
}))

import { useEnsureDestinationOptIn } from '../useEnsureDestinationOptIn'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ADDRESS = 'TESTADDRESS'
const ASSET_ID = 31566704n

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

function renderEnsure() {
    return renderHook(() => useEnsureDestinationOptIn(), {
        wrapper: createWrapper(),
    }).result
}

beforeEach(() => {
    vi.clearAllMocks()
    getSuggestedParamsMock.mockResolvedValue({ minFee: 1000n })
    buildMock.mockResolvedValue({ transactions: [{ txn: { id: 'optin' } }] })
    useMinimumFeeConfigMock.mockReturnValue({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    })
})

describe('onramp/useEnsureDestinationOptIn', () => {
    test('ALGO destination resolves without opt-in or delegation', async () => {
        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: 'ALGO',
            }),
        ).resolves.toBe(true)

        expect(accountInformationMock).not.toHaveBeenCalled()
        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('already opted in resolves without opt-in', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [{ assetId: ASSET_ID }],
        })

        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: ASSET_ID,
            }),
        ).resolves.toBe(true)

        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('not opted in + sufficient ALGO does a self-funded opt-in', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })
        optInMock.mockResolvedValue({ txIds: ['tx1'] })

        const result = renderEnsure()

        await result.current.ensureOptIn({
            address: ADDRESS,
            destinationAssetId: ASSET_ID,
        })

        expect(optInMock).toHaveBeenCalledWith({
            sender: ADDRESS,
            assetId: ASSET_ID,
        })
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('not opted in + insufficient ALGO delegates the opt-in with MBR funding', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 100_000n,
            minBalance: 100_000n,
            assets: [],
        })
        submitWithFeeDelegationMock.mockResolvedValue(undefined)

        const result = renderEnsure()

        await result.current.ensureOptIn({
            address: ADDRESS,
            destinationAssetId: ASSET_ID,
        })

        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).toHaveBeenCalledTimes(1)
        expect(submitWithFeeDelegationMock).toHaveBeenCalledWith({
            account: ADDRESS,
            transactions: [{ id: 'optin' }],
            includeAssetOptInMbr: true,
            optInAssetIds: [ASSET_ID],
            sourceMetadata: expect.objectContaining({
                name: 'onramp-opt-in',
            }),
        })
    })

    test('sponsorship threshold follows the remote-config asset MBR', async () => {
        // Non-default asset MBR (200000). Balance 250000 clears the old
        // threshold (100000 + 100000 + 1000 = 201000 → self-funded) but not
        // the new one (100000 + 200000 + 1000 = 301000 → sponsored/delegated).
        useMinimumFeeConfigMock.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 200_000n,
            baseAccountMbr: 100_000n,
        })
        accountInformationMock.mockResolvedValue({
            amount: 250_000n,
            minBalance: 100_000n,
            assets: [],
        })
        submitWithFeeDelegationMock.mockResolvedValue(undefined)

        const result = renderEnsure()

        await result.current.ensureOptIn({
            address: ADDRESS,
            destinationAssetId: ASSET_ID,
        })

        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).toHaveBeenCalledTimes(1)
    })

    test('asks for confirmation with isSponsored=false when self-funding', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })
        optInMock.mockResolvedValue({ txIds: ['tx1'] })
        const confirmOptIn = vi.fn().mockResolvedValue(true)

        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: ASSET_ID,
                confirmOptIn,
            }),
        ).resolves.toBe(true)

        expect(confirmOptIn).toHaveBeenCalledWith({
            assetId: ASSET_ID,
            isSponsored: false,
        })
        expect(optInMock).toHaveBeenCalledTimes(1)
    })

    test('asks for confirmation with isSponsored=true when delegating', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 100_000n,
            minBalance: 100_000n,
            assets: [],
        })
        submitWithFeeDelegationMock.mockResolvedValue(undefined)
        const confirmOptIn = vi.fn().mockResolvedValue(true)

        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: ASSET_ID,
                confirmOptIn,
            }),
        ).resolves.toBe(true)

        expect(confirmOptIn).toHaveBeenCalledWith({
            assetId: ASSET_ID,
            isSponsored: true,
        })
        expect(submitWithFeeDelegationMock).toHaveBeenCalledTimes(1)
    })

    test('declining the confirmation resolves false and performs nothing', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 100_000n,
            minBalance: 100_000n,
            assets: [],
        })
        const confirmOptIn = vi.fn().mockResolvedValue(false)

        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: ASSET_ID,
                confirmOptIn,
            }),
        ).resolves.toBe(false)

        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('fee-delegation failures propagate to the caller', async () => {
        accountInformationMock.mockResolvedValue({
            amount: 100_000n,
            minBalance: 100_000n,
            assets: [],
        })
        const failure = new Error('attestation missing')
        submitWithFeeDelegationMock.mockRejectedValue(failure)

        const result = renderEnsure()

        await expect(
            result.current.ensureOptIn({
                address: ADDRESS,
                destinationAssetId: ASSET_ID,
            }),
        ).rejects.toBe(failure)
    })
})
