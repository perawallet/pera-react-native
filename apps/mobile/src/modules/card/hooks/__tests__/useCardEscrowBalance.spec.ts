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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnChainAccountInformationQuery } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    escrowCardAddress: null as string | null,
}))

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => ({
    ...(await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )),
    useCardStore: (
        selector: (state: { escrowCardAddress: string | null }) => unknown,
    ) => selector({ escrowCardAddress: mocks.escrowCardAddress }),
}))

import { useCardEscrowBalance } from '../useCardEscrowBalance'

// Tests run on mainnet, so this is the mainnet USDC id.
const USDC_ASSET_ID = 31_566_704n

const onChain = (
    assets: { assetId: bigint; amount: bigint }[],
    isPending = false,
) =>
    vi.mocked(useOnChainAccountInformationQuery).mockReturnValue({
        data: { assets },
        isPending,
    } as ReturnType<typeof useOnChainAccountInformationQuery>)

describe('useCardEscrowBalance', () => {
    beforeEach(() => {
        mocks.escrowCardAddress = 'ESCROWCARD1'
        onChain([])
    })

    it('converts the escrow USDC holding to display units', () => {
        onChain([{ assetId: USDC_ASSET_ID, amount: 1_500_000n }])

        const { result } = renderHook(() => useCardEscrowBalance())

        expect(result.current.balance.toFixed(2)).toBe('1.50')
    })

    it('is zero when the escrow account holds no USDC', () => {
        onChain([{ assetId: 999n, amount: 42_000_000n }])

        const { result } = renderHook(() => useCardEscrowBalance())

        expect(result.current.balance.toString()).toBe('0')
    })

    // With no card there is nothing to query, so the screen must not sit on a
    // skeleton waiting for a request that never fires.
    it('is not loading when no card has been created', () => {
        mocks.escrowCardAddress = null
        onChain([], true)

        const { result } = renderHook(() => useCardEscrowBalance())

        expect(result.current.isLoading).toBe(false)
        expect(result.current.balance.toString()).toBe('0')
    })
})
