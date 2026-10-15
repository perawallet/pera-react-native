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

import { checksumAddress, getAddress, isAddress, keccak256 } from 'viem'
import {
    isNativeAsset,
    type AddressCodec,
    type ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDeeplinkAdapter, toEip681Uri } from '../deeplinks/adapter'
import { ethereumDescriptor } from '../descriptor'

const UNCOMPRESSED_KEY_LENGTH = 65
const UNCOMPRESSED_KEY_PREFIX = 0x04

const normalize = (address: string): string => getAddress(address)

// `0x` plus four hex digits, then the last four: the form wallets show.
const TRUNCATED_HEAD = 6
const TRUNCATED_TAIL = 4

export const ethereumAddressCodec: AddressCodec = {
    chainId: ETHEREUM_CHAIN_ID,
    fromPublicKey: (publicKey, opts) => {
        if (
            opts.scheme !== 'secp256k1' ||
            publicKey.length !== UNCOMPRESSED_KEY_LENGTH ||
            publicKey[0] !== UNCOMPRESSED_KEY_PREFIX
        ) {
            throw new Error(
                'Ethereum addresses derive from a 65-byte uncompressed secp256k1 public key',
            )
        }
        return checksumAddress(
            `0x${keccak256(publicKey.subarray(1)).slice(-40)}`,
        )
    },
    isValid: address => isAddress(address),
    normalize,
    areEqual: (a, b) => a.toLowerCase() === b.toLowerCase(),
    truncate: address =>
        address.length <= TRUNCATED_HEAD + TRUNCATED_TAIL
            ? address
            : `${address.slice(0, TRUNCATED_HEAD)}...${address.slice(-TRUNCATED_TAIL)}`,
    toPaymentUri: toEip681Uri,
    parsePaymentUri: uri => {
        const result = ethereumDeeplinkAdapter.parse(uri)
        if (!result.ok || result.intent.kind !== 'payment') return undefined
        const { target, recipient, assetRef, amount } = result.intent

        const parsed: ParsedPaymentUri = { address: recipient }
        if (target.networkId) parsed.networkId = target.networkId
        if (assetRef && !isNativeAsset(assetRef, ethereumDescriptor)) {
            parsed.assetRef = assetRef
        }
        if (amount) parsed.amount = amount
        return parsed
    },
}
