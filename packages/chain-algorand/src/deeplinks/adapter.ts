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
import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import { isNativeAsset } from '@perawallet/wallet-core-chain-contract'
import {
    uriSchemeOf,
    type ChainDeeplinkIntent,
    type ChainLinkTarget,
    type DeeplinkChainAdapter,
    type DeeplinkParseResult,
} from '@perawallet/wallet-core-deeplinks'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isValidAlgorandAddress } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import {
    algorandApplicationExplorerUrl,
    algorandDescriptor,
} from '../descriptor'
import {
    afterFirstColon,
    DIGITS,
    MALFORMED,
    readArc90Uri,
    readUriQuery,
    toAlgorandAssetRef,
    UNSUPPORTED_NETWORK,
    type Arc90Uri,
} from './arc90'
import { buildAlgorandChainAction } from './chain-action'

const SCHEMES = ['algorand', 'algo', 'algorand-wc'] as const

const targetOf = (networkId?: NetworkId): ChainLinkTarget =>
    networkId === undefined
        ? { chainId: ALGORAND_CHAIN_ID }
        : { chainId: ALGORAND_CHAIN_ID, networkId }

const ok = (intent: ChainDeeplinkIntent): DeeplinkParseResult => ({
    ok: true,
    intent,
})

// Digits when present, so a bad round or fee is refused here rather than at the keyreg sheet.
const isDigitsOrAbsent = (value: Optional<string>): boolean =>
    value === undefined || DIGITS.test(value)

const parseKeyreg = (
    uri: Extract<Arc90Uri, { kind: 'account' }>,
): DeeplinkParseResult => {
    const { query, address } = uri
    if (!address) return MALFORMED

    const voteKeyDilution = query.get('votekd') ?? query.get('votekdkey')
    const fee = query.get('fee')
    const voteFirst = query.get('votefst')
    const voteLast = query.get('votelst')
    if (![fee, voteFirst, voteLast, voteKeyDilution].every(isDigitsOrAbsent)) {
        return MALFORMED
    }

    const voteKey = query.get('votekey')
    const selectionKey = query.get('selkey')
    const stateProofKey = query.get('sprfkey')
    // ARC-78 has no online/offline field: a bare `type=keyreg` is the de-registration.
    const isOnline = [
        voteKey,
        selectionKey,
        stateProofKey,
        voteFirst,
        voteLast,
        voteKeyDilution,
    ].some(Boolean)

    return ok({
        kind: 'chain-action',
        target: targetOf(uri.networkId),
        chainData: {
            family: 'algorand',
            action: 'keyreg',
            sender: address,
            keyregType: isOnline ? 'online' : 'offline',
            voteKey,
            selectionKey,
            stateProofKey,
            voteFirst,
            voteLast,
            voteKeyDilution,
            fee: fee === undefined ? undefined : new Decimal(fee),
            note: query.get('note'),
            xnote: query.get('xnote'),
        },
    })
}

const parseAccount = (
    uri: Extract<Arc90Uri, { kind: 'account' }>,
): DeeplinkParseResult => {
    const { query, address, amount, assetRef } = uri
    const target = targetOf(uri.networkId)

    if (query.get('type') === 'keyreg') return parseKeyreg(uri)

    if (
        amount?.isZero() &&
        assetRef &&
        !isNativeAsset(assetRef, algorandDescriptor)
    ) {
        return ok({
            kind: 'asset-opt-in',
            target,
            assetRef,
            address: address || undefined,
        })
    }
    if (!address) return MALFORMED

    if (assetRef || amount) {
        const xnote = query.get('xnote')
        return ok({
            kind: 'payment',
            target,
            recipient: address,
            assetRef: assetRef ?? algorandDescriptor.nativeAsset.ref,
            amount,
            label: query.get('label'),
            note: query.get('note'),
            chainData: xnote ? { family: 'algorand', xnote } : undefined,
        })
    }
    return ok({
        kind: 'address',
        target,
        address,
        label: query.get('label'),
    })
}

const parseArc90 = (input: string): DeeplinkParseResult => {
    const read = readArc90Uri(input)
    if (!read.ok) return read
    const { uri } = read

    if (uri.kind === 'account') return parseAccount(uri)

    // A link naming no network opens MainNet's explorer.
    const networkId = uri.networkId ?? 'mainnet'
    const url =
        uri.kind === 'asset'
            ? algorandDescriptor.explorer.assetUrl(networkId, uri.assetId)
            : algorandApplicationExplorerUrl(networkId, uri.applicationId)
    if (url === undefined) return UNSUPPORTED_NETWORK
    return ok({
        kind: 'explorer',
        target: targetOf(uri.networkId),
        url: `${url}/`,
    })
}

// `algo:<address>` and `algo:<assetId>/transfer?address=<address>`.
const parseCoinbase = (input: string): DeeplinkParseResult => {
    const text = afterFirstColon(input)
    const q = text.indexOf('?')
    const path = q < 0 ? text : text.slice(0, q)
    const query = readUriQuery(q < 0 ? '' : text.slice(q + 1))
    if (!query) return MALFORMED

    const slash = path.indexOf('/')
    if (slash < 0) {
        return isValidAlgorandAddress(path)
            ? ok({
                  kind: 'address',
                  target: targetOf(),
                  address: path,
              })
            : MALFORMED
    }

    if (path.slice(slash + 1) !== 'transfer') {
        return { ok: false, reason: 'unsupported-action' }
    }
    const assetRef = toAlgorandAssetRef(path.slice(0, slash))
    // Real QR generators leave stray spaces around the address.
    const recipient = query.get('address')?.trim() ?? ''
    if (!assetRef || !isValidAlgorandAddress(recipient)) return MALFORMED
    return ok({ kind: 'payment', target: targetOf(), recipient, assetRef })
}

const canParse = (input: string): boolean =>
    (SCHEMES as readonly string[]).includes(uriSchemeOf(input) ?? '')

// Only the scheme is swapped: unwrapping `?uri=` and the browser hint belong to
// the WalletConnect layer, which this package must not import.
const isWalletConnectWrapper = (input: string): boolean => {
    const scheme = uriSchemeOf(input)
    return (
        scheme === 'algorand-wc' ||
        (scheme === 'algorand' && afterFirstColon(input).startsWith('//wc?'))
    )
}

export const algorandDeeplinkAdapter: DeeplinkChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    schemes: SCHEMES,
    canParse,
    parse: input => {
        if (!canParse(input)) return MALFORMED
        if (isWalletConnectWrapper(input)) {
            return ok({
                kind: 'wallet-connect',
                uri: `wc:${afterFirstColon(input)}`,
            })
        }
        return uriSchemeOf(input) === 'algo'
            ? parseCoinbase(input)
            : parseArc90(input)
    },
    toAssetRef: toAlgorandAssetRef,
    buildChainAction: buildAlgorandChainAction,
}
