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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { SpendApproval } from '@perawallet/wallet-core-chain-contract'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import type { EthereumSimulationSectionState } from '../../EthereumSimulationSection'
import { ethereumPermissionsOf } from '../ethereumPermissions'

type StandardCall = EthereumTransactionPresentation['standardCall']

const HIDDEN: EthereumSimulationSectionState = { status: 'hidden' }
const USDC = { assetId: '0xusdc', decimals: 6 } as PeraAsset

const approvalOf = (amount?: Decimal): SpendApproval => ({
    spender: '0xspender',
    allowances: [
        { assetRef: { chainId: 'ethereum', assetId: '0xusdc' }, amount },
    ],
    isLongLived: true,
})

const tokenApproval = (spendApproval?: SpendApproval): StandardCall =>
    ({
        kind: 'token-approval',
        contract: '0xusdc',
        spender: '0xspender',
        ...(spendApproval && { spendApproval }),
    }) as StandardCall

const grantOf = (
    standardCall: StandardCall,
    asset: PeraAsset | null = null,
    simulation = HIDDEN,
) => ethereumPermissionsOf({ standardCall }, simulation, asset)[0]?.grant

describe('ethereumPermissionsOf', () => {
    it('reads a token approval with no spend approval as a revoke', () => {
        expect(grantOf(tokenApproval(), USDC)).toEqual({ kind: 'revoke' })
    })

    it('shows a zero grant as a grant of 0, in base units without the token record', () => {
        expect(grantOf(tokenApproval(approvalOf(new Decimal(0))))).toEqual({
            kind: 'amount',
            amount: new Decimal(0),
            isBaseUnits: true,
        })
    })

    it('converts a granted amount to display units when the token record is known', () => {
        const grant = grantOf(
            tokenApproval(approvalOf(new Decimal(1_500_000))),
            USDC,
        )

        expect(grant).toMatchObject({ kind: 'amount', isBaseUnits: false })
        expect(grant?.kind === 'amount' && grant.amount.toFixed()).toBe('1.5')
    })

    it('reads an approval with no amount as unlimited', () => {
        expect(grantOf(tokenApproval(approvalOf()), USDC)).toEqual({
            kind: 'unlimited',
        })
    })

    it('grants one NFT, or revokes it when the spender is cleared', () => {
        const nft = (isRevocation: boolean) =>
            ({
                kind: 'nft-approval',
                contract: '0xnft',
                spender: '0xspender',
                tokenId: '7',
                isRevocation,
            }) as StandardCall

        expect(grantOf(nft(false))).toEqual({ kind: 'token', tokenId: '7' })
        expect(grantOf(nft(true))).toEqual({ kind: 'revoke' })
    })

    it('makes a collection-wide approval unlimited, and its removal a revoke', () => {
        const collection = (isApproved: boolean) =>
            ({
                kind: 'collection-approval',
                contract: '0xnft',
                operator: '0xoperator',
                isApproved,
            }) as StandardCall

        expect(
            ethereumPermissionsOf(
                { standardCall: collection(true) },
                HIDDEN,
                null,
            )[0],
        ).toMatchObject({
            spender: '0xoperator',
            isCollectionWide: true,
            grant: { kind: 'unlimited' },
        })
        expect(grantOf(collection(false))).toEqual({ kind: 'revoke' })
    })

    it("prefers the simulation's approvals over the call's", () => {
        const simulation: EthereumSimulationSectionState = {
            status: 'success',
            spend: [],
            receive: [],
            approvals: [
                {
                    key: 'sim',
                    contract: '0xusdc',
                    spender: '0xother',
                    asset: USDC,
                    isCollectionWide: false,
                    grant: { kind: 'revoke' },
                } as Extract<
                    EthereumSimulationSectionState,
                    { status: 'success' }
                >['approvals'][number],
            ],
        }

        const permissions = ethereumPermissionsOf(
            { standardCall: tokenApproval(approvalOf()) },
            simulation,
            USDC,
        )

        expect(permissions).toHaveLength(1)
        expect(permissions[0]).toMatchObject({
            key: 'sim',
            spender: '0xother',
            grant: { kind: 'revoke' },
        })
    })

    it('has nothing to show for a call that grants no permission', () => {
        expect(
            ethereumPermissionsOf({ standardCall: null }, HIDDEN, null),
        ).toEqual([])
    })
})
