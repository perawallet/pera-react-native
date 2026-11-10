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
import {
    useAccountAssetBalanceQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import { useEthereumApprovalDetails } from '../useEthereumApprovalDetails'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountAssetBalanceQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-contract')
        >()
    return {
        ...actual,
        addressCodecs: {
            get: () => ({
                normalize: (address: string) => `checksum(${address})`,
            }),
        },
    }
})

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ACCOUNT = { id: 'account-2' } as unknown as WalletAccount
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'

const presentationWith = (
    standardCall: unknown,
): EthereumTransactionPresentation =>
    ({
        standardCall,
        signingAccount: ACCOUNT,
        scope: SCOPE,
    }) as unknown as EthereumTransactionPresentation

describe('useEthereumApprovalDetails', () => {
    beforeEach(() => {
        vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
            data: null,
        } as ReturnType<typeof useAccountAssetBalanceQuery>)
    })

    it("reads the signer's holding of the token a spend approval covers, by its checksummed address", () => {
        const holding = { assetId: 'checksum', amount: 5 }
        vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
            data: holding,
        } as unknown as ReturnType<typeof useAccountAssetBalanceQuery>)

        const { result } = renderHook(() =>
            useEthereumApprovalDetails(
                presentationWith({
                    kind: 'token-approval',
                    contract: USDT,
                    spendApproval: {},
                }),
            ),
        )

        expect(result.current.tokenBalance).toBe(holding)
        expect(useAccountAssetBalanceQuery).toHaveBeenCalledWith(
            ACCOUNT,
            `checksum(${USDT})`,
            SCOPE,
        )
    })

    it.each([
        ['a revocation', { kind: 'token-approval', contract: USDT }],
        ['an NFT approval', { kind: 'nft-approval', contract: USDT }],
        ['no standard call', null],
    ])('asks for no holding on %s', (_name, standardCall) => {
        const { result } = renderHook(() =>
            useEthereumApprovalDetails(presentationWith(standardCall)),
        )

        expect(result.current.tokenBalance).toBeNull()
        expect(useAccountAssetBalanceQuery).toHaveBeenCalledWith(
            ACCOUNT,
            undefined,
            SCOPE,
        )
    })
})
