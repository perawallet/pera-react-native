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
import { Decimal } from 'decimal.js'
import {
    settleInboxTokens,
    useTokenInboxQuery,
} from '@perawallet/wallet-core-accounts'
import { useTokenRequestDetailScreen } from '../useTokenRequestDetailScreen'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' }

const mocks = vi.hoisted(() => ({ goBack: vi.fn(), showToast: vi.fn() }))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { accountId: 'acct-1', scope: SCOPE, assetId: '0xt' },
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [{ id: 'acct-1' }],
    addressOn: () => '0xabc',
    useTokenInboxQuery: vi.fn(),
    assetFromHoldingLiteRow: (row: { assetId: string; tier?: string }) => ({
        assetId: row.assetId,
        name: 'Token',
        decimals: 0,
        peraMetadata: row.tier ? { verificationTier: row.tier } : undefined,
    }),
    settleInboxTokens: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ goBack: mocks.goBack }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

const withHoldings = (holdings: unknown[]) =>
    vi.mocked(useTokenInboxQuery).mockReturnValue({
        holdings,
        isPending: false,
    } as unknown as ReturnType<typeof useTokenInboxQuery>)

const holding = (tier?: string) => ({
    assetId: '0xt',
    amount: new Decimal(7),
    usdPrice: null,
    tier,
})

describe('useTokenRequestDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        withHoldings([holding()])
    })

    it("reads the token from the account's inbox on its network", () => {
        const { result } = renderHook(() => useTokenRequestDetailScreen())

        expect(useTokenInboxQuery).toHaveBeenCalledWith([
            { address: '0xabc', scope: SCOPE },
        ])
        expect(result.current.token?.amount.toString()).toBe('7')
        expect(result.current.isSuspicious).toBe(false)
    })

    it.each([
        ['accepts', 'handleAccept', true],
        ['rejects', 'handleReject', false],
    ] as const)(
        '%s the token on the device and goes back',
        (_, handler, isAccepted) => {
            const { result } = renderHook(() => useTokenRequestDetailScreen())

            act(() => result.current[handler]())

            expect(settleInboxTokens).toHaveBeenCalledWith(
                [{ address: '0xabc', scope: SCOPE, assetId: '0xt' }],
                isAccepted,
            )
            expect(mocks.showToast).toHaveBeenCalled()
            expect(mocks.goBack).toHaveBeenCalled()
        },
    )

    it('flags a token Pera marks suspicious', () => {
        withHoldings([holding('suspicious')])

        const { result } = renderHook(() => useTokenRequestDetailScreen())

        expect(result.current.isSuspicious).toBe(true)
    })

    it('has nothing to act on once the token has left the inbox', () => {
        withHoldings([])

        const { result } = renderHook(() => useTokenRequestDetailScreen())
        act(() => result.current.handleAccept())

        expect(result.current.token).toBeNull()
        expect(settleInboxTokens).not.toHaveBeenCalled()
    })
})
