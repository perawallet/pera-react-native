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
import {
    CUSTOM_NETWORK_ID,
    type AssetRef,
    type NetworkId,
    type PaymentUriOpts,
} from '@perawallet/wallet-core-chain-contract'
import { getChainConfig } from '@perawallet/wallet-core-config'
import { uriSchemeOf } from '@perawallet/wallet-core-deeplinks'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isValidAlgorandAddress } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../descriptor'

export const afterFirstColon = (input: string): string =>
    input.slice(input.indexOf(':') + 1)

/** `networkId` is set only when the URI names a network. */
export type Arc90Uri =
    | {
          kind: 'account'
          networkId?: NetworkId
          /** `''` when the URI names none. */
          address: string
          query: ReadonlyMap<string, string>
          /** Base units. */
          amount?: Decimal
          /** Set when `asset` is present; `asset=0` is the native ref. */
          assetRef?: AssetRef
      }
    | { kind: 'asset'; networkId?: NetworkId; assetId: string }
    | { kind: 'application'; networkId?: NetworkId; applicationId: string }

export type Arc90ReadResult =
    | { ok: true; uri: Arc90Uri }
    | { ok: false; reason: 'malformed' | 'unsupported-network' }

const SCHEME = 'algorand://'

// ARC-90's `1*DIGIT`, for amount, asset and application ids.
export const DIGITS = /^\d+$/

export const MALFORMED = { ok: false, reason: 'malformed' } as const
export const UNSUPPORTED_NETWORK = {
    ok: false,
    reason: 'unsupported-network',
} as const

// Hand-written: React Native's URLSearchParams serializes differently from
// Node's and throws on a malformed escape.
const writeQuery = (
    fields: ReadonlyArray<readonly [key: string, value: Optional<string>]>,
): string =>
    fields
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
        .join('&')

// `undefined` for a malformed escape or a repeated key: a scanned QR is
// untrusted, and a repeated key makes the request ambiguous. `+` stays literal.
export const readUriQuery = (search: string): Optional<Map<string, string>> => {
    const query = new Map<string, string>()
    for (const segment of search.split('&')) {
        if (!segment) continue
        const eq = segment.indexOf('=')
        const key = eq < 0 ? segment : segment.slice(0, eq)
        let value = ''
        try {
            value = eq < 0 ? '' : decodeURIComponent(segment.slice(eq + 1))
        } catch {
            return undefined
        }
        if (query.has(key)) return undefined
        if (value) query.set(key, value)
    }
    return query
}

export const toAlgorandAssetRef = (raw: string): Optional<AssetRef> =>
    DIGITS.test(raw)
        ? { chainId: ALGORAND_CHAIN_ID, assetId: BigInt(raw).toString() }
        : undefined

export const writeArc90PaymentUri = (
    address: string,
    opts?: PaymentUriOpts,
): string => {
    if (
        opts?.amount &&
        (opts.amount.isNegative() || !opts.amount.isInteger())
    ) {
        throw new Error('Payment amount must be a whole number of base units')
    }
    if (
        opts?.assetRef &&
        (opts.assetRef.chainId !== ALGORAND_CHAIN_ID ||
            !DIGITS.test(opts.assetRef.assetId))
    ) {
        throw new Error('Payment asset must be an Algorand asset id')
    }
    const assetId = opts?.assetRef?.assetId
    const query = writeQuery([
        ['amount', opts?.amount?.toFixed()],
        ['asset', isAlgorandNativeAssetId(assetId) ? undefined : assetId],
        ['label', opts?.label],
        ['note', opts?.note],
    ])
    return `${SCHEME}${address}${query ? `?${query}` : ''}`
}

// A standard-base64 hash holds `/`, so a link carries it escaped or URL-safe;
// comparing without `=` and in one alphabet accepts either spelling.
const normalizeGenesisHash = (hash: string): string =>
    hash.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '')

const savedCustomNode = (): Optional<{
    genesisId: string
    genesisHash: string
}> => {
    try {
        return getChainConfig({
            chainId: ALGORAND_CHAIN_ID,
            networkId: CUSTOM_NETWORK_ID,
        })
    } catch {
        return undefined
    }
}

// An empty value never matches, nor does an unconfigured custom node's empty genesis.
const resolveNetwork = (
    kind: 'net' | 'gh',
    value: string,
): Optional<NetworkId> => {
    let wanted = value
    if (kind === 'gh') {
        try {
            wanted = normalizeGenesisHash(decodeURIComponent(value))
        } catch {
            return undefined
        }
    }
    if (!wanted) return undefined

    const known = algorandDescriptor.networks.find(network => {
        const ref = network.nativeRef
        if (ref.kind !== 'algorand') return false
        return kind === 'net'
            ? network.id === wanted || ref.genesisId === wanted
            : normalizeGenesisHash(ref.genesisHash) === wanted
    })
    if (known) return known.id

    const custom = savedCustomNode()
    if (!custom) return undefined
    const own =
        kind === 'net'
            ? custom.genesisId
            : normalizeGenesisHash(custom.genesisHash)
    return own && own === wanted ? CUSTOM_NETWORK_ID : undefined
}

/** Never throws. */
export const readArc90Uri = (input: string): Arc90ReadResult => {
    if (uriSchemeOf(input) !== 'algorand') return MALFORMED
    const rest = afterFirstColon(input)
    if (!rest.startsWith('//')) return MALFORMED

    const body = rest.slice(2)
    const q = body.indexOf('?')
    let path = q < 0 ? body : body.slice(0, q)
    const search = q < 0 ? '' : body.slice(q + 1)

    let networkId: Optional<NetworkId>
    const named = /^(net|gh):/.exec(path)
    const slash = path.indexOf('/')
    if (named && slash >= 0) {
        networkId = resolveNetwork(
            named[1] as 'net' | 'gh',
            path.slice(named[0].length, slash),
        )
        if (networkId === undefined) return UNSUPPORTED_NETWORK
        path = path.slice(slash + 1)
    }
    // RFC 3986 allows an empty final segment, and Pera's own app-action links
    // are written with one.
    if (path.endsWith('/')) path = path.slice(0, -1)

    if (path.startsWith('asset/') || path.startsWith('app/')) {
        const isAsset = path.startsWith('asset/')
        const id = path.slice(isAsset ? 6 : 4)
        if (!DIGITS.test(id)) return MALFORMED
        return {
            ok: true,
            uri: isAsset
                ? { kind: 'asset', networkId, assetId: id }
                : { kind: 'application', networkId, applicationId: id },
        }
    }

    if (path && !isValidAlgorandAddress(path)) return MALFORMED
    const query = readUriQuery(search)
    if (!query) return MALFORMED

    const uri: Arc90Uri = { kind: 'account', networkId, address: path, query }
    const amount = query.get('amount')
    if (amount !== undefined) {
        if (!DIGITS.test(amount)) return MALFORMED
        uri.amount = new Decimal(amount)
    }
    const asset = query.get('asset')
    if (asset !== undefined) {
        const assetRef = toAlgorandAssetRef(asset)
        if (!assetRef) return MALFORMED
        uri.assetRef = assetRef
    }
    return { ok: true, uri }
}
