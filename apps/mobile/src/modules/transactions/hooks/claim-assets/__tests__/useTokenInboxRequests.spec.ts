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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    assetFromHoldingLiteRow,
    useTokenInboxQuery,
} from '@perawallet/wallet-core-accounts'
import { useTokenInboxRequests } from '../useTokenInboxRequests'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useTokenInboxQuery: vi.fn(() => ({ holdings: [], isPending: false })),
    assetFromHoldingLiteRow: vi.fn(),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as ChainScope

describe('useTokenInboxRequests', () => {
    it('reads nothing until it has an address', () => {
        renderHook(() => useTokenInboxRequests(SCOPE, null))

        expect(useTokenInboxQuery).toHaveBeenLastCalledWith([])
    })

    it('shapes each waiting token as a request with no fee, gain or sender', () => {
        const asset = { assetId: '0x1', name: 'Token' }
        vi.mocked(useTokenInboxQuery).mockReturnValue({
            holdings: [
                {
                    assetId: '0x1',
                    amount: new Decimal(7),
                    usdPrice: new Decimal(2),
                },
                { assetId: '0x2', amount: new Decimal(1), usdPrice: null },
            ] as unknown as ReturnType<typeof useTokenInboxQuery>['holdings'],
            isPending: false,
        })
        vi.mocked(assetFromHoldingLiteRow).mockImplementation(row =>
            row.assetId === '0x1'
                ? (asset as ReturnType<typeof assetFromHoldingLiteRow>)
                : null,
        )

        const { result } = renderHook(() =>
            useTokenInboxRequests(SCOPE, '0xabc'),
        )

        expect(useTokenInboxQuery).toHaveBeenLastCalledWith([
            { address: '0xabc', scope: SCOPE },
        ])
        expect(result.current.data).toEqual([
            {
                inboxAddress: null,
                totalAmount: new Decimal(7),
                asset,
                usdValue: new Decimal(2),
                nativeGainOnClaim: new Decimal(0),
                nativeGainOnReject: new Decimal(0),
                senders: { count: 0, results: [] },
                insufficientNativeForClaiming: false,
                insufficientNativeForRejecting: false,
                shouldUseFundsBeforeClaiming: false,
                shouldUseFundsBeforeRejecting: false,
            },
        ])
    })
})
