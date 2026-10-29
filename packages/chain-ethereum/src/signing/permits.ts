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
import { getAddress, isAddress, maxUint256 } from 'viem'
import type { TypedDataDefinition, TypedDataParameter } from 'viem'
import type {
    SpendAllowance,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { toEvmNftAssetId } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { isRecord } from './adapter'
import { toAllowanceAmount } from './allowance'

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

type Field = readonly [name: string, type: string]

// A schema that differs in any name, type or order hashes to a different
// typehash, so it can never be a signature the real contract accepts.
const EIP2612_PERMIT: readonly Field[] = [
    ['owner', 'address'],
    ['spender', 'address'],
    ['value', 'uint256'],
    ['nonce', 'uint256'],
    ['deadline', 'uint256'],
]
const DAI_PERMIT: readonly Field[] = [
    ['holder', 'address'],
    ['spender', 'address'],
    ['nonce', 'uint256'],
    ['expiry', 'uint256'],
    ['allowed', 'bool'],
]
const ERC721_PERMIT: readonly Field[] = [
    ['spender', 'address'],
    ['tokenId', 'uint256'],
    ['nonce', 'uint256'],
    ['deadline', 'uint256'],
]
const STRUCTS: Record<string, readonly Field[]> = {
    PermitDetails: [
        ['token', 'address'],
        ['amount', 'uint160'],
        ['expiration', 'uint48'],
        ['nonce', 'uint48'],
    ],
    TokenPermissions: [
        ['token', 'address'],
        ['amount', 'uint256'],
    ],
}
const SIGNED_TAIL: readonly Field[] = [
    ['spender', 'address'],
    ['sigDeadline', 'uint256'],
]
const TRANSFER_TAIL: readonly Field[] = [
    ['spender', 'address'],
    ['nonce', 'uint256'],
    ['deadline', 'uint256'],
]

type Permit2Shape = {
    /** The message field holding the allowance struct(s). */
    key: 'details' | 'permitted'
    isBatch: boolean
    /** Permit2 appends one integrator-defined field, whose type is not checked. */
    hasWitness: boolean
}

const PERMIT2_SHAPES: Record<string, Permit2Shape> = {
    PermitSingle: { key: 'details', isBatch: false, hasWitness: false },
    PermitBatch: { key: 'details', isBatch: true, hasWitness: false },
    PermitTransferFrom: { key: 'permitted', isBatch: false, hasWitness: false },
    PermitBatchTransferFrom: {
        key: 'permitted',
        isBatch: true,
        hasWitness: false,
    },
    PermitWitnessTransferFrom: {
        key: 'permitted',
        isBatch: false,
        hasWitness: true,
    },
    PermitBatchWitnessTransferFrom: {
        key: 'permitted',
        isBatch: true,
        hasWitness: true,
    },
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
// The largest time a JS Date holds; a later deadline is one that never lapses.
const MAX_DATE_MS = 8_640_000_000_000_000n

type Types = Record<string, readonly TypedDataParameter[]>

const matches = (
    actual: readonly TypedDataParameter[] | undefined,
    expected: readonly Field[],
    extra = 0,
): boolean =>
    !!actual &&
    actual.length === expected.length + extra &&
    expected.every(
        ([name, type], index) =>
            actual[index].name === name && actual[index].type === type,
    )

// WalletConnect JSON-parses the payload, so a uint arrives as a string or number.
const toUint = (value: unknown): bigint | undefined => {
    if (
        typeof value !== 'bigint' &&
        typeof value !== 'number' &&
        (typeof value !== 'string' || value.trim() === '')
    ) {
        return undefined
    }
    try {
        const uint = BigInt(value)
        return uint < 0n ? undefined : uint
    } catch {
        return undefined
    }
}

const toAddress = (value: unknown): string | undefined =>
    typeof value === 'string' && isAddress(value, { strict: false })
        ? getAddress(value)
        : undefined

// The token's chain is the request's, so the asset ref is completed by the caller.
type TokenAllowance = Omit<SpendAllowance, 'assetRef'> & { assetId: string }

const toAllowance = (
    token: unknown,
    amount: unknown,
): TokenAllowance | undefined => {
    const assetId = toAddress(token)
    const base = toUint(amount)
    if (assetId === undefined || base === undefined) return undefined
    const allowance = toAllowanceAmount(base)
    return { assetId, ...(allowance && { amount: allowance }) }
}

const toNftAllowance = (
    contract: unknown,
    tokenId: unknown,
): TokenAllowance | undefined => {
    const address = toAddress(contract)
    const id = toUint(tokenId)
    if (address === undefined || id === undefined || id > maxUint256) {
        return undefined
    }
    return {
        assetId: toEvmNftAssetId(address, id.toString()),
        amount: new Decimal(1),
    }
}

type Parsed = {
    spender: unknown
    allowances: (TokenAllowance | undefined)[]
    /** Unix seconds; undefined when a deadline can't be read. */
    expiry: bigint | undefined
}

const parsePermit = (
    message: Record<string, unknown>,
    token: unknown,
): Parsed => ({
    spender: message.spender,
    allowances: [toAllowance(token, message.value)],
    expiry: toUint(message.deadline),
})

// DAI grants its whole balance when `allowed` is true and nothing otherwise;
// an expiry of 0 means it never lapses.
const parseDaiPermit = (
    message: Record<string, unknown>,
    token: unknown,
): Parsed => {
    const expiry = toUint(message.expiry)
    return {
        spender: message.spender,
        allowances:
            message.allowed === true ? [toAllowance(token, maxUint256)] : [],
        expiry: expiry === 0n ? maxUint256 : expiry,
    }
}

const parseErc721Permit = (
    message: Record<string, unknown>,
    contract: unknown,
): Parsed => ({
    spender: message.spender,
    allowances: [toNftAllowance(contract, message.tokenId)],
    expiry: toUint(message.deadline),
})

type PermitShape = {
    fields: readonly Field[]
    parse: (
        message: Record<string, unknown>,
        verifyingContract: unknown,
    ) => Parsed
}

const PERMIT_SHAPES: readonly PermitShape[] = [
    { fields: EIP2612_PERMIT, parse: parsePermit },
    { fields: DAI_PERMIT, parse: parseDaiPermit },
    { fields: ERC721_PERMIT, parse: parseErc721Permit },
]

const parsePermit2 = (
    { key, isBatch }: Permit2Shape,
    message: Record<string, unknown>,
): Parsed => {
    const entries = (isBatch ? message[key] : [message[key]]) as unknown
    if (!Array.isArray(entries)) {
        return { spender: message.spender, allowances: [], expiry: undefined }
    }
    const records = entries.map(entry => (isRecord(entry) ? entry : {}))
    const deadline = toUint(
        message[key === 'details' ? 'sigDeadline' : 'deadline'],
    )
    // Permit2's `expiration` of 0 means "this block only", so only the
    // signature's own deadline bounds it.
    const expiries = records.map(entry => {
        if (key !== 'details') return deadline
        const expiration = toUint(entry.expiration)
        return expiration === 0n ? deadline : expiration
    })
    return {
        spender: message.spender,
        allowances: records.map(entry =>
            toAllowance(entry.token, entry.amount),
        ),
        expiry: expiries.reduce<bigint | undefined>((latest, expiry) => {
            if (latest === undefined || expiry === undefined) {
                return undefined
            }
            return expiry > latest ? expiry : latest
        }, 0n),
    }
}

const parseTypedData = (typedData: TypedDataDefinition): Parsed | undefined => {
    const { primaryType, message, domain } = typedData as {
        primaryType: string
        message: Record<string, unknown>
        domain?: Record<string, unknown>
    }
    const types = typedData.types as Types
    const verifyingContract = domain?.verifyingContract

    if (primaryType === 'Permit') {
        // The token is the contract that verifies the signature.
        const permit = PERMIT_SHAPES.find(({ fields }) =>
            matches(types.Permit, fields),
        )
        return permit && toAddress(verifyingContract) !== undefined
            ? permit.parse(message, verifyingContract)
            : undefined
    }

    const shape = PERMIT2_SHAPES[primaryType]
    if (
        !shape ||
        typeof verifyingContract !== 'string' ||
        !areEvmAddressesEqual(verifyingContract, PERMIT2_ADDRESS)
    ) {
        return undefined
    }
    const struct =
        shape.key === 'details' ? 'PermitDetails' : 'TokenPermissions'
    const head: Field = [shape.key, shape.isBatch ? `${struct}[]` : struct]
    const tail = shape.key === 'details' ? SIGNED_TAIL : TRANSFER_TAIL
    return matches(
        types[primaryType],
        [head, ...tail],
        shape.hasWitness ? 1 : 0,
    ) && matches(types[struct], STRUCTS[struct])
        ? parsePermit2(shape, message)
        : undefined
}

/** EIP-2612, DAI-style or ERC-721 `Permit`, or Permit2 typed data, complete or not. Never throws. */
export const isPermitTypedData = (typedData: unknown): boolean => {
    try {
        return parseTypedData(typedData as TypedDataDefinition) !== undefined
    } catch {
        return false
    }
}

/**
 * Recognises EIP-2612, DAI-style or ERC-721 `Permit`, or Permit2 typed data that
 * lets `spender` move the signer's tokens or NFT. `now` is Unix ms. Never throws;
 * anything it doesn't match exactly yields `undefined`.
 */
export const spendApprovalOf = (
    typedData: TypedDataDefinition,
    now: number,
    chain: EvmChain,
): SpendApproval | undefined => {
    try {
        const parsed = parseTypedData(typedData)
        const spender = parsed && toAddress(parsed.spender)
        if (
            !parsed ||
            spender === undefined ||
            parsed.allowances.length === 0 ||
            parsed.expiry === undefined ||
            parsed.allowances.some(allowance => !allowance)
        ) {
            return undefined
        }
        const ms = parsed.expiry * 1000n
        const deadline = ms > MAX_DATE_MS ? undefined : Number(ms)
        return {
            spender,
            allowances: (parsed.allowances as TokenAllowance[]).map(
                ({ assetId, ...allowance }) => ({
                    ...allowance,
                    assetRef: { chainId: chain.row.id, assetId },
                }),
            ),
            ...(deadline !== undefined && { deadline }),
            isLongLived: deadline === undefined || deadline - now > YEAR_MS,
        }
    } catch {
        return undefined
    }
}
