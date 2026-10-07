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

const SCHEME = 'algorand://'

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
    // Only the address and the plain query fields; ARC-90 parsing is not
    // behind the codec yet.
    toPaymentUri: (address, opts) => {
        const query = new URLSearchParams()
        if (opts?.amount) query.set('amount', opts.amount.toString())
        if (opts?.assetRef) query.set('asset', opts.assetRef.assetId)
        if (opts?.label) query.set('label', opts.label)
        if (opts?.note) query.set('note', opts.note)
        const search = query.toString()
        return `${SCHEME}${address}${search ? `?${search}` : ''}`
    },
    parsePaymentUri: uri => {
        if (!uri.startsWith(SCHEME)) return undefined
        const [address, search = ''] = uri.slice(SCHEME.length).split('?')
        if (!isValidAlgorandAddress(address)) return undefined
        const query = new URLSearchParams(search)
        const parsed: ParsedPaymentUri = { address }
        const amount = query.get('amount')
        const asset = query.get('asset')
        const label = query.get('label')
        const note = query.get('note')
        if (amount) parsed.amount = new Decimal(amount)
        if (asset)
            parsed.assetRef = { chainId: ALGORAND_CHAIN_ID, assetId: asset }
        if (label) parsed.label = label
        if (note) parsed.note = note
        return parsed
    },
}
