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
    ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import {
    deriveQuantumAddress,
    encodeAlgorandAddress,
    isValidAlgorandAddress,
} from '../blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { isAlgorandNativeAssetId } from '../descriptor'
import { readArc90Uri, writeArc90PaymentUri } from '../deeplinks/arc90'

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
    truncate: address => truncateAlgorandAddress(address),
    resembles: (a, b) =>
        a !== b && truncateAlgorandAddress(a) === truncateAlgorandAddress(b),
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
