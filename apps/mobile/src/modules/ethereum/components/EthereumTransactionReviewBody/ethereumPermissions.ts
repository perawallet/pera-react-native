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

import type { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import type {
    EthereumApprovalGrant,
    EthereumSimulationSectionState,
} from '../EthereumSimulationSection'

/** One permission the transaction grants or removes, from the simulation or else the call itself. */
export type EthereumPermission = {
    key: string
    spender: string
    /** Set when the spender is in the well-known contract registry. */
    spenderName?: string
    /** The token contract, or the NFT collection. */
    contract: string
    /** The token a fungible permission covers; null for an NFT or while its record is unread. */
    asset: Nullable<PeraAsset>
    collectionName?: string
    isCollectionWide: boolean
    grant: EthereumApprovalGrant
}

const amountGrantOf = (
    amount: Optional<Decimal>,
    asset: Nullable<PeraAsset>,
): EthereumApprovalGrant => {
    if (amount === undefined) return { kind: 'unlimited' }
    // A revoke never gets here (it carries no spend approval), so a zero is a real grant of nothing.
    return asset
        ? {
              kind: 'amount',
              amount: baseUnitsToDisplayUnits(amount, asset.decimals),
              isBaseUnits: false,
          }
        : { kind: 'amount', amount, isBaseUnits: true }
}

/**
 * The simulation's approvals when it has them; otherwise what a standard
 * approval call grants, read from its calldata. `tokenAsset` is the approved
 * token's record, when the store has it.
 */
export const ethereumPermissionsOf = (
    presentation: Pick<EthereumTransactionPresentation, 'standardCall'>,
    simulation: EthereumSimulationSectionState,
    tokenAsset: Nullable<PeraAsset>,
): EthereumPermission[] => {
    if (simulation.status === 'success' && simulation.approvals.length > 0) {
        return simulation.approvals.map(approval => ({
            key: approval.key,
            spender: approval.spender,
            spenderName: approval.spenderName,
            contract: approval.contract,
            asset: approval.asset,
            isCollectionWide: approval.isCollectionWide,
            grant: approval.grant,
        }))
    }
    const { standardCall } = presentation
    switch (standardCall?.kind) {
        case 'token-approval': {
            const approval = standardCall.spendApproval
            const allowance = approval?.allowances[0]
            return [
                {
                    key: `${standardCall.contract}-${standardCall.spender}`,
                    spender: standardCall.spender,
                    spenderName: approval?.knownSpender?.name,
                    contract: standardCall.contract,
                    asset: tokenAsset,
                    isCollectionWide: false,
                    grant: approval
                        ? amountGrantOf(allowance?.amount, tokenAsset)
                        : { kind: 'revoke' },
                },
            ]
        }
        case 'nft-approval': {
            return [
                {
                    key: `${standardCall.contract}-${standardCall.tokenId}`,
                    spender: standardCall.spender,
                    contract: standardCall.contract,
                    asset: null,
                    collectionName: standardCall.collectionName,
                    isCollectionWide: false,
                    grant: standardCall.isRevocation
                        ? { kind: 'revoke' }
                        : { kind: 'token', tokenId: standardCall.tokenId },
                },
            ]
        }
        case 'collection-approval': {
            return [
                {
                    key: `${standardCall.contract}-${standardCall.operator}`,
                    spender: standardCall.operator,
                    contract: standardCall.contract,
                    asset: null,
                    isCollectionWide: true,
                    grant: standardCall.isApproved
                        ? { kind: 'unlimited' }
                        : { kind: 'revoke' },
                },
            ]
        }
        default: {
            return []
        }
    }
}
