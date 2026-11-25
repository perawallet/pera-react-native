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

import type {
    AddressCodec,
    AddressShape,
    ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import {
    deriveQuantumAddress,
    encodeAlgorandAddress,
    isValidAlgorandAddress,
} from '../blockchain'
import {
    SHORT_ADDRESS_LENGTH,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { isAlgorandNativeAssetId } from '../descriptor'
import { readArc90Uri, writeArc90PaymentUri } from '../deeplinks/arc90'

// One character short of each end the short form shows: a poisoner missing
// only the character beside the ellipsis still reads as the same address.
const RESEMBLING_END_LENGTH = (SHORT_ADDRESS_LENGTH - 1) / 2 - 1

// Valid addresses are 58 base32 characters; this also catches a few characters
// short or long, lower-cased, or with a non-base32 typo such as 0 or 1. Names
// and account names don't run to 40 characters without a space or a dot.
const ALGORAND_ADDRESS_START = /^[A-Za-z0-9]{40,}$/
// Within three of the 58 characters: a paste gone wrong, not a prefix being typed.
const NEAR_FULL_LENGTH = 55

const algorandAddressShape = (input: string): AddressShape => {
    if (!ALGORAND_ADDRESS_START.test(input)) return 'none'
    return input.length >= NEAR_FULL_LENGTH ? 'complete' : 'partial'
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
    addressShape: algorandAddressShape,
    normalize: address => address,
    areEqual: (a, b) => a === b,
    truncate: address => truncateAlgorandAddress(address),
    resembles: (a, b) =>
        a !== b &&
        a.slice(0, RESEMBLING_END_LENGTH) ===
            b.slice(0, RESEMBLING_END_LENGTH) &&
        a.slice(-RESEMBLING_END_LENGTH) === b.slice(-RESEMBLING_END_LENGTH),
    toPaymentUri: writeArc90PaymentUri,
    parsePaymentUri: uri => {
        const read = readArc90Uri(uri)
        if (!read.ok || read.uri.kind !== 'account') return undefined
        const { address, query, amount, assetRef, networkId } = read.uri
        if (!address || query.get('type') === 'keyreg') return undefined
        const parsed: ParsedPaymentUri = { address }
        if (amount) parsed.amount = amount
        if (assetRef && !isAlgorandNativeAssetId(assetRef.assetId))
            parsed.assetRef = assetRef
        const label = query.get('label')
        const note = query.get('note')
        if (label) parsed.label = label
        if (note) parsed.note = note
        if (networkId) parsed.networkId = networkId
        return parsed
    },
}
