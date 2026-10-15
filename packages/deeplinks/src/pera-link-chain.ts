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

import {
    addressCodecs,
    type AssetRef,
    type ChainActionData,
    type ChainId,
    type ChainPaymentData,
} from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapters } from './chain-adapter'
import type { ChainLinkTarget } from './models'
import { readBaseUnits } from './utils'

/**
 * Pera links name no chain, and every one issued so far belongs to this one.
 * This file is the only place that says so, so a link that names its own chain
 * replaces it here and nowhere else.
 */
export const PERA_LINK_CHAIN_ID = 'algorand' satisfies ChainId

export const peraLinkTarget = (): ChainLinkTarget => ({
    chainId: PERA_LINK_CHAIN_ID,
})

/** The parsers pass optional params straight through, so an absent one is simply not an address. */
export const isPeraLinkAddress = (address: string | undefined): boolean =>
    !!address &&
    addressCodecs.has(PERA_LINK_CHAIN_ID) &&
    addressCodecs.get(PERA_LINK_CHAIN_ID).isValid(address)

/** `undefined` when the id is not one the chain spells, or its adapter isn't registered. */
export const toPeraLinkAssetRef = (raw: string): AssetRef | undefined =>
    deeplinkAdapters.has(PERA_LINK_CHAIN_ID)
        ? deeplinkAdapters.get(PERA_LINK_CHAIN_ID).toAssetRef(raw)
        : undefined

export type PeraKeyregParams = {
    sender: string
    keyregType?: 'online' | 'offline'
    voteKey?: string
    selectionKey?: string
    stateProofKey?: string
    voteFirst?: string
    voteLast?: string
    voteKeyDilution?: string
    fee?: string
    note?: string
    xnote?: string
}

/**
 * Pera's own links may state the intent outright; anything else is read off the
 * participation keys, because a bare `type=keyreg` is the de-registration. A
 * *partial* key set resolves to `online`, never `offline`: the user scanned a
 * go-online QR, and quietly building a de-registration would drop their node
 * out of consensus. The handler rejects the incomplete set instead.
 */
const inferKeyregType = (params: PeraKeyregParams): 'online' | 'offline' =>
    [
        params.voteKey,
        params.selectionKey,
        params.stateProofKey,
        params.voteFirst,
        params.voteLast,
        params.voteKeyDilution,
    ].some(Boolean)
        ? 'online'
        : 'offline'

/** `undefined` when `fee` is present and not digits. */
export const toPeraKeyregAction = (
    params: PeraKeyregParams,
): ChainActionData | undefined => {
    const fee = params.fee ? readBaseUnits(params.fee) : undefined
    if (params.fee && !fee) return undefined

    return {
        family: 'algorand',
        action: 'keyreg',
        sender: params.sender,
        keyregType: params.keyregType ?? inferKeyregType(params),
        voteKey: params.voteKey,
        selectionKey: params.selectionKey,
        stateProofKey: params.stateProofKey,
        voteFirst: params.voteFirst,
        voteLast: params.voteLast,
        voteKeyDilution: params.voteKeyDilution,
        fee,
        note: params.note,
        xnote: params.xnote,
    }
}

export const toPeraPaymentData = (
    xnote: string | undefined,
): ChainPaymentData | undefined =>
    xnote ? { family: 'algorand', xnote } : undefined
