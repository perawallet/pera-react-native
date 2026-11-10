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
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useEthereumContractLabel } from '../../../../hooks/useEthereumContractLabel'
import type { EthereumApprovalChangePresentation } from '../../useEthereumSimulationSection'
import { useEthereumApprovalChangeRow } from '../useEthereumApprovalChangeRow'

vi.mock('@hooks/useLanguage')
vi.mock('../../../../hooks/useEthereumContractLabel', () => ({
    useEthereumContractLabel: vi.fn(
        (_scope: unknown, _address: unknown, bundled: unknown) =>
            bundled ?? null,
    ),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const USDC = { assetId: '0xUSDC', unitName: 'USDC' } as PeraAsset

const changeOf = (
    overrides: Partial<EthereumApprovalChangePresentation> = {},
): EthereumApprovalChangePresentation => ({
    key: 'k',
    contract: '0xUSDC',
    spender: '0xSPENDER',
    asset: USDC,
    isCollectionWide: false,
    grant: { kind: 'unlimited' },
    ...overrides,
})

const read = (change: EthereumApprovalChangePresentation) =>
    renderHook(() => useEthereumApprovalChangeRow(change, SCOPE)).result.current

describe('useEthereumApprovalChangeRow', () => {
    describe('title', () => {
        it.each([
            [
                'a known spender and a known token',
                { spenderName: 'Permit2' },
                'signing.spend_approval.allow_title',
            ],
            [
                'a known spender and an unread token',
                { spenderName: 'Permit2', asset: null },
                'signing.spend_approval.allow_title_assets',
            ],
            [
                'an unknown spender and a known token',
                {},
                'signing.spend_approval.allow_title_unknown',
            ],
            [
                'an unknown spender and an unread token',
                { asset: null },
                'signing.spend_approval.allow_title_unknown_assets',
            ],
        ])('reads %s as the spend-approval title', (_name, overrides, key) => {
            expect(read(changeOf(overrides)).title).toBe(key)
        })

        it('titles a revoke by whether its token is known', () => {
            const grant = { kind: 'revoke' } as const

            expect(read(changeOf({ grant })).title).toBe(
                'ethereum.simulation.revoke_title',
            )
            expect(read(changeOf({ grant, asset: null })).title).toBe(
                'ethereum.simulation.revoke_title_assets',
            )
        })
    })

    it("names the spender as Pera's curated label does, as the transaction's own approval would", () => {
        vi.mocked(useEthereumContractLabel).mockReturnValueOnce({
            name: 'Aave V3 Pool',
        })

        const result = read(changeOf())

        expect(result.spenderName).toBe('Aave V3 Pool')
        expect(result.notice).toEqual({
            titleKey: 'signing.spend_approval.known_unlimited_note',
            params: { name: 'Aave V3 Pool' },
            isWarning: false,
        })
        expect(useEthereumContractLabel).toHaveBeenCalledWith(
            SCOPE,
            '0xSPENDER',
            undefined,
        )
    })

    describe('notice', () => {
        it('warns that an unlimited grant to an unknown spender exposes the whole balance', () => {
            expect(read(changeOf()).notice).toEqual({
                titleKey: 'signing.spend_approval.unlimited_warning',
                isWarning: true,
            })
        })

        it('reads an unlimited grant to a registry spender as information, naming it', () => {
            expect(read(changeOf({ spenderName: 'Permit2' })).notice).toEqual({
                titleKey: 'signing.spend_approval.known_unlimited_note',
                params: { name: 'Permit2' },
                isWarning: false,
            })
        })

        it('warns on a collection-wide grant even to a registry spender', () => {
            expect(
                read(
                    changeOf({
                        isCollectionWide: true,
                        spenderName: 'Seaport',
                    }),
                ).notice,
            ).toEqual({
                titleKey: 'signing.collection_approval.warning',
                isWarning: true,
            })
        })

        it.each([
            [
                'a limited amount',
                { kind: 'amount', amount: new Decimal(5), isBaseUnits: false },
            ],
            ['one token', { kind: 'token', tokenId: '12' }],
            ['a revoke', { kind: 'revoke' }],
        ] as const)('has none for %s', (_name, grant) => {
            expect(read(changeOf({ grant })).notice).toBeUndefined()
        })
    })
})
