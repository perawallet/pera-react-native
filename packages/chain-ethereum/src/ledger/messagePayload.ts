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

import {
    getTypesForEIP712Domain,
    hashDomain,
    hashStruct,
    isAddress,
    isHex,
    stringify,
} from 'viem'
import type { Address, Hex, TypedData, TypedDataDefinition } from 'viem'

/** What the Ledger Ethereum app takes for a message. */
export type EthereumLedgerMessageBody =
    | {
          kind: 'personal'
          /** The exact bytes signed, before the EIP-191 prefix. */
          message: Hex
      }
    | {
          kind: 'typedData'
          /** With `EIP712Domain` declared, which the app needs to hash the domain. */
          typedData: TypedDataDefinition
          /** For the app's hashed mode, where the host does the hashing. */
          domainSeparator: Hex
          structHash: Hex
      }

/**
 * A plan's `devicePayload`. `signer` lets the driver refuse a signature that
 * doesn't recover to it over the host's digest, since the app hashes on-device.
 */
export type EthereumLedgerMessage = EthereumLedgerMessageBody & {
    signer: Address
}

const MALFORMED = 'Not an encoded Ethereum Ledger message'

const HASH_LENGTH = 66

const MAX_SAFE_CHAIN_ID = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * Resolves `EIP712Domain` as viem's `hashTypedData` does, so the device hashes
 * the same domain the planned digest did, in either mode.
 */
export const typedDataLedgerMessage = (
    typedData: TypedDataDefinition,
): EthereumLedgerMessageBody => {
    const { domain = {}, message, primaryType } = typedData
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...(typedData.types as TypedData),
    }
    // The parse leaves chainId a bigint, which JSON can only carry as a
    // string; EIP-155 chain ids fit a JSON number, as dApps send them.
    const { chainId } = domain
    const deviceDomain =
        typeof chainId === 'bigint' && chainId <= MAX_SAFE_CHAIN_ID
            ? { ...domain, chainId: Number(chainId) }
            : domain
    return {
        kind: 'typedData',
        typedData: {
            ...typedData,
            // hw-app-eth reads `domain.chainId` unguarded in full mode.
            domain: deviceDomain,
            types,
        } as unknown as TypedDataDefinition,
        domainSeparator: hashDomain({ domain, types }),
        structHash: hashStruct({
            data: message as Record<string, unknown>,
            primaryType: primaryType as string,
            types,
        }),
    }
}

// `stringify` because a parsed domain carries its chainId as a bigint.
export const encodeEthereumLedgerMessage = (
    message: EthereumLedgerMessage,
): Uint8Array => new TextEncoder().encode(stringify(message))

const isHash = (value: unknown): value is Hex =>
    typeof value === 'string' && value.length === HASH_LENGTH && isHex(value)

/** @throws on bytes {@link encodeEthereumLedgerMessage} did not produce. */
export const decodeEthereumLedgerMessage = (
    payload: Uint8Array,
): EthereumLedgerMessage => {
    let parsed: unknown
    try {
        parsed = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(payload),
        )
    } catch (error) {
        throw new Error(MALFORMED, { cause: error })
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error(MALFORMED)
    }
    const record = parsed as Record<string, unknown>
    const { signer } = record
    if (typeof signer !== 'string' || !isAddress(signer, { strict: false })) {
        throw new Error(MALFORMED)
    }
    if (
        record.kind === 'personal' &&
        typeof record.message === 'string' &&
        isHex(record.message, { strict: true })
    ) {
        return { kind: 'personal', message: record.message, signer }
    }
    if (
        record.kind === 'typedData' &&
        typeof record.typedData === 'object' &&
        record.typedData !== null &&
        isHash(record.domainSeparator) &&
        isHash(record.structHash)
    ) {
        return {
            kind: 'typedData',
            typedData: record.typedData as TypedDataDefinition,
            domainSeparator: record.domainSeparator,
            structHash: record.structHash,
            signer,
        }
    }
    throw new Error(MALFORMED)
}
