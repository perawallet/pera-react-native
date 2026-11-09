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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const {
    optInMock,
    accountInformationMock,
    getSuggestedParamsMock,
    buildMock,
    addAssetOptInMock,
    newGroupMock,
    submitWithFeeDelegationMock,
} = vi.hoisted(() => {
    const addAssetOptIn = vi.fn()
    const build = vi.fn()
    return {
        optInMock: vi.fn(),
        accountInformationMock: vi.fn(),
        getSuggestedParamsMock: vi.fn(),
        buildMock: build,
        addAssetOptInMock: addAssetOptIn,
        newGroupMock: vi.fn(() => ({ addAssetOptIn, build })),
        submitWithFeeDelegationMock: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({ optIn: optInMock }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('../../blockchain', async () => ({
    ...(await vi.importActual<object>('../../blockchain')),
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: () => ({ do: accountInformationMock }),
            },
        },
        getSuggestedParams: getSuggestedParamsMock,
        newGroup: newGroupMock,
    }),
    useMinimumFeeConfig: () => ({ assetMbr: 100_000n }),
}))

vi.mock('../../fee-delegation', async () => ({
    ...(await vi.importActual<object>('../../fee-delegation')),
    useFeeDelegation: () => ({
        submitWithFeeDelegation: submitWithFeeDelegationMock,
    }),
}))

vi.mock('../../signing/unsignedTransaction', () => ({
    toUnsignedAlgorandTransactions: (transactions: unknown[]) => transactions,
}))

import { useEnsureSwapAssetOptIn } from '../useEnsureSwapAssetOptIn'

const ADDRESS = 'TESTADDRESS'
const ASA = 31566704n
const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const ensure = (assetId = ASA.toString()) => {
    const { result } = renderHook(() => useEnsureSwapAssetOptIn())
    return result.current({ address: ADDRESS, scope: SCOPE, assetId })
}

describe('useEnsureSwapAssetOptIn', () => {
    beforeEach(() => {
        getSuggestedParamsMock.mockResolvedValue({ minFee: 1000 })
        buildMock.mockResolvedValue({ transactions: [{ txn: 'opt-in' }] })
        optInMock.mockResolvedValue(undefined)
        submitWithFeeDelegationMock.mockResolvedValue(undefined)
    })

    test('has nothing to do for the native asset', async () => {
        await expect(ensure('0')).resolves.toBe(true)

        expect(accountInformationMock).not.toHaveBeenCalled()
    })

    test('has nothing to do when already opted in', async () => {
        accountInformationMock.mockResolvedValue({
            assets: [{ assetId: ASA }],
            amount: 0n,
            minBalance: 0n,
        })

        await expect(ensure()).resolves.toBe(true)

        expect(optInMock).not.toHaveBeenCalled()
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('opts in itself with enough spare balance', async () => {
        accountInformationMock.mockResolvedValue({
            assets: [],
            amount: 1_000_000n,
            minBalance: 100_000n,
        })

        await expect(ensure()).resolves.toBe(true)

        expect(optInMock).toHaveBeenCalledWith({
            sender: ADDRESS,
            assetId: ASA,
        })
        expect(submitWithFeeDelegationMock).not.toHaveBeenCalled()
    })

    test('opts in with a sponsor when the balance falls short', async () => {
        accountInformationMock.mockResolvedValue({
            assets: [],
            amount: 100_000n,
            minBalance: 100_000n,
        })

        await expect(ensure()).resolves.toBe(true)

        expect(optInMock).not.toHaveBeenCalled()
        expect(addAssetOptInMock).toHaveBeenCalledWith(
            expect.objectContaining({ sender: ADDRESS, assetId: ASA }),
        )
        expect(submitWithFeeDelegationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                account: ADDRESS,
                includeAssetOptInMbr: true,
                optInAssetIds: [ASA],
            }),
        )
    })

    test('lets a failed sponsorship reach the caller', async () => {
        accountInformationMock.mockResolvedValue({
            assets: [],
            amount: 0n,
            minBalance: 100_000n,
        })
        submitWithFeeDelegationMock.mockRejectedValue(new Error('attestation'))

        await expect(ensure()).rejects.toThrow('attestation')
    })
})
