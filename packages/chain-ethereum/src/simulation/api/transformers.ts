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
import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    eip155ChainIdOfNetwork,
    fromCaip19,
} from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import { knownSpenderOf } from '../../signing/known-contracts'
import type {
    EvmApprovalChange,
    EvmAssetChange,
    EvmTransactionSimulation,
} from '../types'
import type { EvmSimulationResponse } from './schema'

type ResponseAssetChange = EvmSimulationResponse['asset_changes'][number]
type ResponseApprovalChange = EvmSimulationResponse['approval_changes'][number]

const toAssetChange = (
    change: ResponseAssetChange,
    scope: ChainScope,
    chain: EvmChain,
): EvmAssetChange => {
    const isNft = change.standard === 'erc721' || change.standard === 'erc1155'
    if (isNft && change.token_id === null) {
        throw new Error(`${change.asset_id} is an NFT change with no token id`)
    }
    // An NFT's CAIP-19 id carries its token id; the backend sends it beside the id.
    const caip19 = isNft
        ? `${change.asset_id}/${change.token_id}`
        : change.asset_id
    return {
        assetId: fromCaip19(caip19, scope, chain),
        standard: change.standard,
        amount: new Decimal(change.amount),
    }
}

const toApprovalChange = (
    change: ResponseApprovalChange,
    eip155ChainId: Optional<number>,
): EvmApprovalChange => {
    const knownSpender = knownSpenderOf(eip155ChainId, change.spender)
    return {
        contract: getAddress(change.contract),
        spender: getAddress(change.spender),
        ...(knownSpender && { knownSpender }),
        ...(change.token_id !== null && { tokenId: change.token_id }),
        isCollectionWide: change.collection_wide,
        ...(change.allowance !== 'unlimited' && {
            amount: new Decimal(change.allowance),
        }),
    }
}

/**
 * Throws on anything it can't read, so a half-understood answer never shows as
 * a complete prediction.
 */
export const toEvmTransactionSimulation = (
    response: EvmSimulationResponse,
    scope: ChainScope,
    chain: EvmChain,
): EvmTransactionSimulation => {
    if (response.status === 'unavailable') return { status: 'unavailable' }
    if (response.status === 'reverted') {
        return { status: 'reverted', revertReason: response.revert_reason }
    }
    if (response.block_number === null) {
        throw new Error('A successful simulation names no block')
    }
    const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
    return {
        status: 'success',
        blockNumber: response.block_number,
        assetChanges: response.asset_changes.map(change =>
            toAssetChange(change, scope, chain),
        ),
        approvalChanges: response.approval_changes.map(change =>
            toApprovalChange(change, eip155ChainId),
        ),
    }
}
