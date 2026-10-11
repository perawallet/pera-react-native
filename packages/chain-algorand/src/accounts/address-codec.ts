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
import type {
    AddressCodec,
    ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import { deriveQuantumAddress, encodeAlgorandAddress } from '../blockchain'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { isAlgorandNativeAssetId } from '../descriptor'

const SCHEME = 'algorand://'

// ARC-90's `1*DIGIT`, for both amount and asset.
const DIGITS = /^\d+$/

// Hand-written: React Native's URLSearchParams serializes differently from
// Node's and throws on a malformed escape.
const writeQuery = (
    fields: ReadonlyArray<readonly [key: string, value: string | undefined]>,
): string =>
    fields
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
        .join('&')

// `undefined` for a malformed escape or a repeated key: a scanned QR is
// untrusted, and a repeated key makes the request ambiguous. `+` stays literal.
const readQuery = (search: string): Map<string, string> | undefined => {
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

// Algorand addresses are upper-case base32 with a checksum, and a lower-case
// spelling fails the checksum, so there is exactly one valid spelling.
export const algorandAddressCodec: AddressCodec = {
    chainId: ALGORAND_CHAIN_ID,
    fromPublicKey: (publicKey, opts) =>
        opts.scheme === 'falcon-1024'
            ? deriveQuantumAddress(publicKey)
            : encodeAlgorandAddress(publicKey),
    isValid: address => isValidAlgorandAddress(address),
    normalize: address => address,
    areEqual: (a, b) => a === b,
    toPaymentUri: (address, opts) => {
        if (
            opts?.amount &&
            (opts.amount.isNegative() || !opts.amount.isInteger())
        ) {
            throw new Error(
                'Payment amount must be a whole number of base units',
            )
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
    },
    parsePaymentUri: uri => {
        if (!uri.startsWith(SCHEME)) return undefined
        const rest = uri.slice(SCHEME.length)
        const q = rest.indexOf('?')
        const path = (q < 0 ? rest : rest.slice(0, q)).replace(/\/$/, '')
        // A network-scoped URI is declined rather than read as a payment on
        // the active network.
        if (!isValidAlgorandAddress(path)) return undefined
        const query = readQuery(q < 0 ? '' : rest.slice(q + 1))
        if (!query || query.get('type') === 'keyreg') return undefined
        const parsed: ParsedPaymentUri = { address: path }
        const amount = query.get('amount')
        const asset = query.get('asset')
        if (amount !== undefined) {
            if (!DIGITS.test(amount)) return undefined
            parsed.amount = new Decimal(amount)
        }
        if (asset !== undefined) {
            if (!DIGITS.test(asset)) return undefined
            const assetId = BigInt(asset).toString()
            if (!isAlgorandNativeAssetId(assetId))
                parsed.assetRef = { chainId: ALGORAND_CHAIN_ID, assetId }
        }
        const label = query.get('label')
        const note = query.get('note')
        if (label) parsed.label = label
        if (note) parsed.note = note
        return parsed
    },
}
