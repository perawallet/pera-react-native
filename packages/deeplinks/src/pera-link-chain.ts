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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    addressCodecs,
    type AssetRef,
    type ChainActionData,
    type ChainId,
    type ChainPaymentData,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { deeplinkAdapters } from './chain-adapter'
import type { ChainLinkTarget, DeeplinkParseFailure } from './models'
import { readBaseUnits, readPeraAppLink } from './utils'

/**
 * A Pera link without `chain=` targets this chain: every link issued before the
 * param existed is Algorand's. This file is the only place that says so.
 */
export const PERA_LINK_CHAIN_ID = 'algorand' satisfies ChainId

export const peraLinkTarget = (): ChainLinkTarget => ({
    chainId: PERA_LINK_CHAIN_ID,
})

/** The `perawallet://app/<path>` paths that read `chain=`; every other path ignores it. */
const CHAIN_SCOPED_PATHS: ReadonlySet<string> = new Set([
    'add-contact',
    'edit-contact',
    'register-watch-account',
    'add-watch-account',
    'receiver-account-selection',
    'address-actions',
    'asset-transfer',
    'asset-opt-in',
    'asset-detail',
    'account-detail',
    'swap',
    'buy',
    'sell',
])

export const isChainScopedPeraPath = (path: string): boolean =>
    CHAIN_SCOPED_PATHS.has(path)

export type PeraLinkChainFailure =
    | Extract<DeeplinkParseFailure, 'unsupported-network'>
    | 'chain-unavailable'

export type PeraLinkTargetResolution =
    | { ok: true; target: ChainLinkTarget }
    | { ok: false; reason: PeraLinkChainFailure }

/** `chain` is the raw CAIP-2 param; absent means the legacy chain with no network. */
export const resolvePeraLinkTarget = (
    chain: Optional<string>,
): PeraLinkTargetResolution => {
    if (chain === undefined) return { ok: true, target: peraLinkTarget() }

    const { chains } = getProvider()
    const resolved = chains.byCaip2(chain)
    if (!resolved) return { ok: false, reason: 'unsupported-network' }
    if (chains.isSwitchedOff(resolved.chainId)) {
        return { ok: false, reason: 'chain-unavailable' }
    }
    return {
        ok: true,
        target: { chainId: resolved.chainId, networkId: resolved.network.id },
    }
}

/**
 * Why a Pera app link's `chain=` can't be honoured, else `undefined`. The
 * parser only answers "no link", so callers ask this to tell the user the
 * chain is unsupported instead of treating the link as noise.
 */
export const peraLinkChainFailure = (
    url: string,
): Optional<PeraLinkChainFailure> => {
    const link = readPeraAppLink(url)
    if (!link || !isChainScopedPeraPath(link.action)) return undefined
    const resolution = resolvePeraLinkTarget(link.params.chain)
    return resolution.ok ? undefined : resolution.reason
}

/** The parsers pass optional params straight through, so an absent one is simply not an address. */
export const isPeraLinkAddress = (address: Optional<string>): boolean =>
    !!address &&
    addressCodecs.has(PERA_LINK_CHAIN_ID) &&
    addressCodecs.get(PERA_LINK_CHAIN_ID).isValid(address)

/** `undefined` when the id is not one the target chain spells, or its adapter isn't registered. */
export const toLinkAssetRef = (
    target: ChainLinkTarget,
    raw: string,
): Optional<AssetRef> =>
    deeplinkAdapters.has(target.chainId)
        ? deeplinkAdapters.get(target.chainId).toAssetRef(raw)
        : undefined

export const toPeraLinkAssetRef = (raw: string): Optional<AssetRef> =>
    toLinkAssetRef(peraLinkTarget(), raw)

export type PeraKeyregParams = {
    sender: string
    keyregType?: 'online' | 'offline'
    voteKey?: string
    selectionKey?: string
    stateProofKey?: string
    voteFirst?: string
    voteLast?: string
    voteKeyDilution?: string
    /** Raw query text; parsed as base units by {@link toPeraKeyregAction}. */
    feeParam?: string
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

/** `undefined` when `feeParam` is present and not digits. */
export const toPeraKeyregAction = (
    params: PeraKeyregParams,
): Optional<ChainActionData> => {
    const fee = params.feeParam ? readBaseUnits(params.feeParam) : undefined
    if (params.feeParam && !fee) return undefined

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
    xnote: Optional<string>,
): Optional<ChainPaymentData> =>
    xnote ? { family: 'algorand', xnote } : undefined
