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
    type AddressShape,
    type ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../chains/types'
import { parseEvmPaymentUri, toEip681Uri } from '../deeplinks/adapter'

const UNCOMPRESSED_KEY_LENGTH = 65
const UNCOMPRESSED_KEY_PREFIX = 0x04

// `0x` and four characters is a deliberate address attempt (a truncated paste
// like `0x1234`); fewer is someone starting to type. A dot makes it an ENS name.
const EVM_ADDRESS_START = /^0x[^\s.]{4,}$/i
// `0x` and 38 of the 40 hex digits: a few short is a paste gone wrong, not a prefix being typed.
const NEAR_FULL_LENGTH = 40

const evmAddressShape = (input: string): AddressShape => {
    if (!EVM_ADDRESS_START.test(input)) return 'none'
    return input.length >= NEAR_FULL_LENGTH ? 'complete' : 'partial'
}

export const normalizeEvmAddress = (address: string): string =>
    getAddress(address)

// `0x` plus four hex digits, then the last four: the form wallets show.
const TRUNCATED_HEAD = 6
const TRUNCATED_TAIL = 4

// The same derivation on every EVM chain: an address is the key's, not the chain's.
export const evmAddressFromPublicKey: AddressCodec['fromPublicKey'] = (
    publicKey,
    opts,
) => {
    if (
        opts.scheme !== 'secp256k1' ||
        publicKey.length !== UNCOMPRESSED_KEY_LENGTH ||
        publicKey[0] !== UNCOMPRESSED_KEY_PREFIX
    ) {
        throw new Error(
            'Ethereum addresses derive from a 65-byte uncompressed secp256k1 public key',
        )
    }
    return checksumAddress(`0x${keccak256(publicKey.subarray(1)).slice(-40)}`)
}

export const areEvmAddressesEqual = (a: string, b: string): boolean =>
    a.toLowerCase() === b.toLowerCase()

// Checksummed first: a backend's lowercase address would otherwise read
// differently from the same address on every other screen.
export const truncateEvmAddress = (address: string): string => {
    const shown = isAddress(address, { strict: false })
        ? getAddress(address)
        : address
    return shown.length <= TRUNCATED_HEAD + TRUNCATED_TAIL
        ? shown
        : `${shown.slice(0, TRUNCATED_HEAD)}...${shown.slice(-TRUNCATED_TAIL)}`
}

// One character short of each end the short form shows, so a poisoner missing
// only the character beside the ellipsis still reads as the same address.
const RESEMBLING_HEAD = TRUNCATED_HEAD - 1
const RESEMBLING_TAIL = TRUNCATED_TAIL - 1

// Checksum case is noise to a reader, so the ends compare case-blind.
const doEvmAddressesResemble = (a: string, b: string): boolean => {
    if (areEvmAddressesEqual(a, b)) return false
    const [left, right] = [a.toLowerCase(), b.toLowerCase()]
    return (
        left.slice(0, RESEMBLING_HEAD) === right.slice(0, RESEMBLING_HEAD) &&
        left.slice(-RESEMBLING_TAIL) === right.slice(-RESEMBLING_TAIL)
    )
}

export const createEvmAddressCodec = (chain: EvmChain): AddressCodec => ({
    chainId: chain.row.id,
    fromPublicKey: evmAddressFromPublicKey,
    isValid: address => isAddress(address),
    addressShape: evmAddressShape,
    normalize: normalizeEvmAddress,
    areEqual: areEvmAddressesEqual,
    truncate: truncateEvmAddress,
    resembles: doEvmAddressesResemble,
    toPaymentUri: (address, opts) => toEip681Uri(chain, address, opts),
    // A link for another EVM chain is that chain's codec's to read.
    parsePaymentUri: uri => {
        const result = parseEvmPaymentUri(uri)
        if (!result.ok || result.intent.kind !== 'payment') return undefined
        const { target, recipient, assetRef, amount } = result.intent
        if (target.chainId !== chain.row.id) return undefined
        // A name is no address until it is resolved, so a form has none to read.
        if (!('address' in recipient)) return undefined

        const parsed: ParsedPaymentUri = { address: recipient.address }
        if (target.networkId) parsed.networkId = target.networkId
        if (assetRef && !isNativeAsset(assetRef, chain.descriptor)) {
            parsed.assetRef = assetRef
        }
        if (amount) parsed.amount = amount
        return parsed
    },
})
