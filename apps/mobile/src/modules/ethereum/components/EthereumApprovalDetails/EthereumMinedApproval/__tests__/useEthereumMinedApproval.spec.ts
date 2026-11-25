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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPresentation } from '../../../../hooks/useEthereumTransactionPresentation'
import { useEthereumMinedApproval } from '../useEthereumMinedApproval'

const navigate = vi.hoisted(() => vi.fn())
const canList = vi.hoisted(() => ({ current: true }))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    addressCodecs: {
        get: () => ({
            truncate: (address: string) =>
                `${address.slice(0, 6)}...${address.slice(-4)}`,
        }),
    },
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate }),
}))
vi.mock('@hooks/useCapability', () => ({
    useCapability: () => canList.current,
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

const SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const SPENDER = '0xa0d9C1e9F4bB0C7aA7E1e2b6c7b7F4a6E0dDfC24'
const ACCOUNT = { id: 'account-1' }

const presentationWith = (
    standardCall: unknown,
    signingAccount: unknown = ACCOUNT,
): EthereumTransactionPresentation =>
    ({
        standardCall,
        signingAccount,
        scope: SCOPE,
    }) as unknown as EthereumTransactionPresentation

const spendApproval = (overrides: Record<string, unknown> = {}) => ({
    kind: 'token-approval',
    spendApproval: {
        spender: SPENDER,
        allowances: [{ assetRef: { chainId: 'base', assetId: '0xweth' } }],
        isLongLived: true,
        ...overrides,
    },
})

describe('useEthereumMinedApproval', () => {
    beforeEach(() => {
        navigate.mockReset()
        canList.current = true
    })

    it('says an unlimited approval was granted to the spender Pera knows', () => {
        const { result } = renderHook(() =>
            useEthereumMinedApproval(
                presentationWith(
                    spendApproval({
                        knownSpender: { name: 'Aave V3 Gateway' },
                    }),
                ),
            ),
        )

        expect(result.current.grantText).toBe(
            'transactions.record_detail.approval_granted_unlimited {"spender":"Aave V3 Gateway"}',
        )
    })

    it('says a capped approval was granted, naming an unknown spender by its short address', () => {
        const { result } = renderHook(() =>
            useEthereumMinedApproval(
                presentationWith(
                    spendApproval({
                        allowances: [
                            {
                                assetRef: {
                                    chainId: 'base',
                                    assetId: '0xweth',
                                },
                                amount: { isZero: () => false },
                            },
                        ],
                    }),
                ),
            ),
        )

        expect(result.current.grantText).toBe(
            'transactions.record_detail.approval_granted {"spender":"0xa0d9...fC24"}',
        )
    })

    it("opens the signer's token approvals on the transaction's network", () => {
        const { result } = renderHook(() =>
            useEthereumMinedApproval(presentationWith(spendApproval())),
        )

        result.current.handleOpenTokenApprovals?.()

        expect(navigate).toHaveBeenCalledWith('TokenApprovals', {
            accountId: 'account-1',
            scope: SCOPE,
        })
    })

    it.each([
        [
            'no account of the wallet signed it',
            presentationWith(spendApproval(), null),
        ],
        ['it grants nothing', presentationWith({ kind: 'token-approval' })],
    ])('offers no approvals link when %s', (_label, presentation) => {
        const { result } = renderHook(() =>
            useEthereumMinedApproval(presentation),
        )

        expect(result.current.handleOpenTokenApprovals).toBeUndefined()
    })

    it('offers no approvals link on a chain that cannot list them', () => {
        canList.current = false

        const { result } = renderHook(() =>
            useEthereumMinedApproval(presentationWith(spendApproval())),
        )

        expect(result.current.handleOpenTokenApprovals).toBeUndefined()
    })
})
