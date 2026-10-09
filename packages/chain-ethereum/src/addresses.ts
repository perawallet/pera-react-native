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
import { checksumAddress, getAddress, isAddress, keccak256 } from 'viem'
import {
    isNativeAsset,
    type AddressCodec,
    type NetworkId,
    type ParsedPaymentUri,
} from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM_CHAIN_ID } from './chain-id'
import { ethereumDescriptor } from './descriptor'

const SCHEME = 'ethereum:'
const UNCOMPRESSED_KEY_LENGTH = 65
const UNCOMPRESSED_KEY_PREFIX = 0x04

// An ENS name never matches: it needs async resolution.
const TARGET_PATTERN = /^(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/(\w+))?$/

const AMOUNT_PATTERN = /^\d+(\.\d+)?([eE]\d+)?$/

const eip155ChainIdOf = (networkId: NetworkId | undefined) => {
    const nativeRef = ethereumDescriptor.networks.find(
        n => n.id === networkId,
    )?.nativeRef
    return nativeRef?.kind === 'evm' ? nativeRef.eip155ChainId : undefined
}

const networkIdOf = (eip155ChainId: number): NetworkId | undefined =>
    ethereumDescriptor.networks.find(
        n =>
            n.nativeRef.kind === 'evm' &&
            n.nativeRef.eip155ChainId === eip155ChainId,
    )?.id

// Base units are whole numbers; a fraction means display units leaked in.
const parseBaseUnits = (raw: string): Decimal | undefined => {
    if (!AMOUNT_PATTERN.test(raw)) return undefined
    const amount = new Decimal(raw)
    return amount.isInteger() ? amount : undefined
}

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
    toPaymentUri: (address, opts) => {
        if (
            opts?.amount &&
            (opts.amount.isNegative() || !opts.amount.isInteger())
        ) {
            throw new Error(
                'Payment amount must be a whole number of base units',
            )
        }
        // toFixed: Decimal#toString gives "1e+21", which EIP-681 cannot parse.
        const amount = opts?.amount?.toFixed()
        const eip155ChainId = eip155ChainIdOf(opts?.networkId)
        const chain = eip155ChainId === undefined ? '' : `@${eip155ChainId}`
        const assetRef = opts?.assetRef

        if (!assetRef || isNativeAsset(assetRef, ethereumDescriptor)) {
            return `${SCHEME}${normalize(address)}${chain}${amount ? `?value=${amount}` : ''}`
        }
        return `${SCHEME}${normalize(assetRef.assetId)}${chain}/transfer?address=${normalize(address)}${amount ? `&uint256=${amount}` : ''}`
    },
    parsePaymentUri: uri => {
        if (!uri.startsWith(SCHEME)) return undefined
        const [path, search = ''] = uri.slice(SCHEME.length).split('?')
        const match = TARGET_PATTERN.exec(path)
        if (!match) return undefined
        const [, target, rawChainId, fn] = match
        if (!isAddress(target)) return undefined

        const parsed: ParsedPaymentUri = { address: normalize(target) }
        if (rawChainId !== undefined) {
            const networkId = networkIdOf(Number(rawChainId))
            if (!networkId) return undefined
            parsed.networkId = networkId
        }

        const query = new URLSearchParams(search)
        let rawAmount: string | null
        if (fn === undefined) {
            rawAmount = query.get('value')
        } else if (fn === 'transfer') {
            const recipient = query.get('address')
            if (!recipient || !isAddress(recipient)) return undefined
            parsed.assetRef = {
                chainId: ETHEREUM_CHAIN_ID,
                assetId: normalize(target),
            }
            parsed.address = normalize(recipient)
            rawAmount = query.get('uint256')
        } else {
            return undefined
        }

        if (rawAmount !== null) {
            const amount = parseBaseUnits(rawAmount)
            if (!amount) return undefined
            parsed.amount = amount
        }
        return parsed
    },
}
