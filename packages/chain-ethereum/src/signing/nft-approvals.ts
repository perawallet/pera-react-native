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

import { getAssetsByIds } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { normalizeEvmAddress } from '../accounts/address-codec'
import { toEvmNftAssetId } from '../blockchain/utils/caip19'
import type { EvmStandardCall } from './standard-call-types'

export type EvmApproveCall = Extract<EvmStandardCall, { kind: 'approve' }>

const nftIdOf = (call: EvmApproveCall): Optional<string> => {
    try {
        return toEvmNftAssetId(call.contract, call.value.toFixed())
    } catch {
        return undefined
    }
}

/** The NFT asset id `call` grants, when `nftApprovals` names it. */
export const nftApprovalIdOf = (
    call: EvmApproveCall,
    nftApprovals: ReadonlySet<string>,
): Optional<string> => {
    const id = nftIdOf(call)
    return id !== undefined && nftApprovals.has(id) ? id : undefined
}

/**
 * The NFT asset ids these `approve` calls grant, as the local asset store
 * knows them: `approve` shares its selector between ERC-20 and ERC-721, and
 * only the token's own records tell a token id from an allowance. A fungible
 * record wins, as the app's presentation reads it. Local reads only; an
 * unreadable store names none, so callers keep the ERC-20 reading.
 */
export const readNftApprovalIds = async (
    calls: EvmApproveCall[],
    scope: ChainScope,
): Promise<ReadonlySet<string>> => {
    const candidates = calls.flatMap(call => {
        const nftId = nftIdOf(call)
        return nftId === undefined
            ? []
            : [{ fungibleId: normalizeEvmAddress(call.contract), nftId }]
    })
    if (candidates.length === 0) return new Set()
    try {
        const stored = await getAssetsByIds({
            assetIds: [
                ...new Set(
                    candidates.flatMap(({ fungibleId, nftId }) => [
                        fungibleId,
                        nftId,
                    ]),
                ),
            ],
            scope,
        })
        const ids = new Set(stored.map(asset => asset.assetId))
        return new Set(
            candidates
                .filter(
                    ({ fungibleId, nftId }) =>
                        ids.has(nftId) && !ids.has(fungibleId),
                )
                .map(({ nftId }) => nftId),
        )
    } catch (error) {
        logger.warn('Could not read NFT approvals from the asset store', {
            error,
        })
        return new Set()
    }
}
