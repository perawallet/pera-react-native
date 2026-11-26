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
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { useAssetInboxRequestsQuery } from '@perawallet/wallet-core-transactions'
import { useAssetTransferRequestsScreen } from '../useAssetTransferRequestsScreen'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE = { chainId: 'base', networkId: 'mainnet' }
const ACCOUNT = { id: 'acct-1', custody: { kind: 'local', seed: null } }

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    showToast: vi.fn(),
    request: vi.fn(),
    setAccountAddress: vi.fn(),
    setAssetRequests: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: { accountId: 'acct-1' } }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [ACCOUNT],
    useAccountHoldingSources: () => [
        { address: 'ALGO_ADDR', scope: ALGORAND },
        { address: '0xabc', scope: ETHEREUM },
        { address: '0xabc', scope: BASE },
    ],
    receivesUnaskedAssets: (chainId: string) => chainId !== 'algorand',
    useRegisteredChainIds: () => ['algorand'],
    useTokenInboxQuery: vi.fn(),
    assetFromHoldingLiteRow: (row: { assetId: string; tier?: string }) => ({
        assetId: row.assetId,
        name: row.assetId,
        decimals: 0,
        peraMetadata: row.tier ? { verificationTier: row.tier } : undefined,
    }),
    settleInboxTokens: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetInboxRequestsQuery: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        setAccountAddress: mocks.setAccountAddress,
        setAssetRequests: mocks.setAssetRequests,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mocks.push }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

const holding = (scope: typeof ETHEREUM, assetId: string, tier?: string) => ({
    address: '0xabc',
    scope,
    assetId,
    amount: new Decimal(5),
    usdPrice: null,
    tier,
})

const claim = { asset: { assetId: '77' } }

const setInbox = ({
    claims = [] as unknown[],
    tokens = [] as unknown[],
    error = null as Error | null,
} = {}) => {
    vi.mocked(useAssetInboxRequestsQuery).mockReturnValue({
        data: claims,
        isPending: false,
        isError: error !== null,
        error,
        isUnavailableOnNetwork: false,
    } as unknown as ReturnType<typeof useAssetInboxRequestsQuery>)
    vi.mocked(useTokenInboxQuery).mockReturnValue({
        holdings: tokens,
        isPending: false,
    } as unknown as ReturnType<typeof useTokenInboxQuery>)
}

const render = () => renderHook(() => useAssetTransferRequestsScreen())

describe('useAssetTransferRequestsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setInbox({
            claims: [claim],
            tokens: [
                holding(BASE, '0xb'),
                holding(ETHEREUM, '0xe', 'suspicious'),
            ],
        })
    })

    it("lists the account's requests under a header per chain, the backend's first, then each network in source order", () => {
        const { result } = render()

        expect(
            result.current.rows.map(row =>
                row.kind === 'header' ? `# ${row.chainId}` : row.key,
            ),
        ).toEqual([
            '# algorand',
            'claim|77|0',
            '# ethereum',
            'token|ethereum/mainnet|0xe',
            '# base',
            'token|base/mainnet|0xb',
        ])
        expect(useAssetInboxRequestsQuery).toHaveBeenCalledWith(
            ALGORAND,
            'ALGO_ADDR',
        )
    })

    it('opens a backend request in the claim flow', () => {
        const { result } = render()

        act(() => result.current.handleRowPress(result.current.rows[1]!))

        expect(mocks.setAccountAddress).toHaveBeenCalledWith('ALGO_ADDR')
        expect(mocks.setAssetRequests).toHaveBeenCalledWith([claim])
        expect(mocks.push).toHaveBeenCalledWith('Messages', {
            screen: 'AssetClaimDetail',
            params: { assetIndex: 0, scope: ALGORAND },
        })
    })

    it('opens a waiting token on its own screen', () => {
        const { result } = render()

        act(() => result.current.handleRowPress(result.current.rows[3]!))

        expect(mocks.push).toHaveBeenCalledWith('Messages', {
            screen: 'TokenRequestDetail',
            params: { accountId: 'acct-1', scope: ETHEREUM, assetId: '0xe' },
        })
    })

    it('accepts every waiting token once confirmed, naming the suspicious ones and the claims it leaves', async () => {
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render()

        await act(async () => result.current.handleAcceptAll())

        const sheet = mocks.request.mock.calls[0]![0].contents
        expect(sheet.props.message).toContain(
            'asset_inbox.requests.accept_all_suspicious',
        )
        expect(sheet.props.message).toContain(
            'asset_inbox.requests.settle_all_skips_claims',
        )
        expect(settleInboxTokens).toHaveBeenCalledWith(
            [
                { address: '0xabc', scope: BASE, assetId: '0xb' },
                { address: '0xabc', scope: ETHEREUM, assetId: '0xe' },
            ],
            true,
        )
        expect(mocks.showToast).toHaveBeenCalled()
    })

    it('leaves every token waiting when Reject All is cancelled', async () => {
        mocks.request.mockResolvedValueOnce(false)
        const { result } = render()

        await act(async () => result.current.handleRejectAll())

        expect(settleInboxTokens).not.toHaveBeenCalled()
    })

    it('offers Accept All and Reject All only while tokens wait on the device', () => {
        expect(render().result.current.canSettleAll).toBe(true)

        setInbox({ claims: [claim] })

        expect(render().result.current.canSettleAll).toBe(false)
    })

    it('flags a refusal for want of an integrity token', () => {
        setInbox({
            error: new IntegrityRequiredError({
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                status: 403,
                hadToken: false,
            }),
        })

        expect(render().result.current.isIntegrityBlocked).toBe(true)
    })
})
