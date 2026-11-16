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
import { Decimal } from 'decimal.js'
import type {
    ChainScope,
    TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useTokenApprovalsScreen } from '../useTokenApprovalsScreen'

const mocks = vi.hoisted(() => {
    class UserRejectedSigningError extends Error {}
    return {
        UserRejectedSigningError,
        errorToast: vi.fn(),
        revoke: vi.fn(),
        refetch: vi.fn(),
        canSign: true,
        revokingApproval: null as unknown,
        approvals: {
            data: [] as unknown[],
            isPending: false,
            isError: false,
        },
        assets: new Map<string, unknown>(),
        isAssetsPending: false,
        params: {} as unknown,
    }
})

const scope: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS = '0x00000000000000000000000000000000000000aa'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const APES = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
const SPENDER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

const account: WalletAccount = {
    id: 'eth-1',
    name: '',
    chains: { ethereum: { address: ADDRESS, keyPairId: 'key-1' } },
    custody: { kind: 'local', seed: null },
}

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mocks.params }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => [account],
    addressOn: () => ADDRESS,
    useCanSignWith: () => mocks.canSign,
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: () => ({
        data: mocks.assets,
        isPending: mocks.isAssetsPending,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    UserRejectedSigningError: mocks.UserRejectedSigningError,
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTokenApprovalsQuery: () => ({
        ...mocks.approvals,
        refetch: mocks.refetch,
    }),
    useRevokeTokenApprovalMutation: () => ({
        revoke: mocks.revoke,
        revokingApproval: mocks.revokingApproval,
        isPending: mocks.revokingApproval !== null,
    }),
}))

const unlimited: TokenApproval = {
    kind: 'allowance',
    assetRef: { chainId: 'ethereum', assetId: USDC },
    spender: SPENDER,
}

const limited: TokenApproval = { ...unlimited, amount: new Decimal(2_500_000) }

const collection: TokenApproval = {
    kind: 'collection',
    collection: APES,
    collectionName: 'Apes',
    spender: SPENDER,
}

const USDC_ASSET = {
    assetId: USDC,
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
} as PeraAsset

const render = () => renderHook(() => useTokenApprovalsScreen()).result

describe('useTokenApprovalsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.params = { accountId: 'eth-1', scope }
        mocks.canSign = true
        mocks.revokingApproval = null
        mocks.approvals = { data: [], isPending: false, isError: false }
        mocks.assets = new Map()
        mocks.isAssetsPending = false
        mocks.revoke.mockResolvedValue(undefined)
    })

    it('lists an unlimited allowance with no amount, and a collection with no token record', () => {
        mocks.approvals.data = [unlimited, collection]
        mocks.assets = new Map([[USDC, USDC_ASSET]])

        const result = render()

        expect(result.current.items).toEqual([
            {
                id: `${USDC}:${SPENDER}`.toLowerCase(),
                approval: unlimited,
                asset: USDC_ASSET,
                isTokenPending: false,
                isRevocable: true,
                amount: null,
            },
            {
                id: `${APES}:${SPENDER}`.toLowerCase(),
                approval: collection,
                asset: null,
                isTokenPending: false,
                isRevocable: true,
                amount: null,
            },
        ])
    })

    it('shows a limited allowance in display units of its token', () => {
        mocks.approvals.data = [limited]
        mocks.assets = new Map([[USDC, USDC_ASSET]])

        const [item] = render().current.items

        expect(item?.amount?.toFixed()).toBe('2.5')
    })

    it('keeps a limited allowance in base units while the token is unknown', () => {
        mocks.approvals.data = [limited]

        const [item] = render().current.items

        expect(item?.asset).toBeNull()
        expect(item?.amount?.toFixed()).toBe('2500000')
    })

    it('marks an allowance pending while its token record loads, so no amount or revoke is offered early', () => {
        mocks.approvals.data = [limited, unlimited, collection]
        mocks.isAssetsPending = true

        const items = render().current.items

        expect(items.map(item => item.isTokenPending)).toEqual([
            true,
            true,
            false,
        ])
    })

    it('offers no revoke for an allowance whose token record never loaded, since review would show a zero grant', () => {
        mocks.approvals.data = [unlimited, collection]
        mocks.assets = new Map()
        mocks.isAssetsPending = false

        const [token, nft] = render().current.items

        expect(token).toMatchObject({
            isTokenPending: false,
            isRevocable: false,
        })
        expect(nft?.isRevocable).toBe(true)
    })

    it('offers no revoke while the token record is loading either', () => {
        mocks.approvals.data = [unlimited]
        mocks.isAssetsPending = true

        const [token] = render().current.items

        expect(token).toMatchObject({
            isTokenPending: true,
            isRevocable: false,
        })
    })

    it('lets an account that can sign revoke, and a watch account only look', () => {
        expect(render().current.canRevoke).toBe(true)

        mocks.canSign = false

        expect(render().current.canRevoke).toBe(false)
    })

    it('revokes the chosen approval from the account’s address on the row’s network', () => {
        mocks.approvals.data = [unlimited]
        const result = render()

        act(() => result.current.handleRevoke(result.current.items[0]!))

        expect(mocks.revoke).toHaveBeenCalledWith({
            scope,
            account: ADDRESS,
            approval: unlimited,
        })
    })

    it('marks the approval being revoked', () => {
        mocks.approvals.data = [unlimited]
        mocks.revokingApproval = unlimited

        expect(render().current.revokingId).toBe(
            `${USDC}:${SPENDER}`.toLowerCase(),
        )
    })

    it('stays silent when the user declines the review', async () => {
        mocks.approvals.data = [unlimited]
        mocks.revoke.mockRejectedValue(new mocks.UserRejectedSigningError())
        const result = render()

        await act(async () =>
            result.current.handleRevoke(result.current.items[0]!),
        )

        expect(mocks.errorToast).not.toHaveBeenCalled()
    })

    it('tells the user when a revoke fails', async () => {
        mocks.approvals.data = [unlimited]
        mocks.revoke.mockRejectedValue(new Error('reverted'))
        const result = render()

        await act(async () =>
            result.current.handleRevoke(result.current.items[0]!),
        )

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'token_approvals.revoke_error_title',
            'token_approvals.revoke_error_body',
        )
    })

    it('reports the list reading, failing and reading again', () => {
        mocks.approvals = { data: [], isPending: true, isError: false }
        expect(render().current.isPending).toBe(true)

        mocks.approvals = { data: [], isPending: false, isError: true }
        const result = render()
        expect(result.current.isError).toBe(true)

        result.current.handleRetry()
        expect(mocks.refetch).toHaveBeenCalledOnce()
    })
})
