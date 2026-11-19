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

import { getTypesForEIP712Domain } from 'viem'
import type { TypedDataParameter } from 'viem'
import { arrayRegex, integerRegex } from 'viem/utils'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isRecord } from './adapter'

type Types = Record<string, readonly TypedDataParameter[] | undefined>

// WalletConnect JSON-parses the payload, so a uint arrives as a string or number.
// viem's hashing also takes `[x]`, `[]`, `true` and `''` as integers; those
// are left unread so the review can never show less than what is hashed.
export const readTypedDataInteger = (value: unknown): Optional<bigint> => {
    if (
        typeof value !== 'bigint' &&
        !(typeof value === 'number' && Number.isInteger(value)) &&
        (typeof value !== 'string' || value.trim() === '')
    ) {
        return undefined
    }
    try {
        return BigInt(value)
    } catch {
        return undefined
    }
}

// Mirrors viem's `encodeField`: struct, then any type ending in `]` as an array,
// then atomic, where any `uint*`/`int*` name is hashed as an integer. A type name
// the readers (tree, address screening) resolve differently is refused too.
const isUnreadable = (types: Types, type: string, value: unknown): boolean => {
    const struct = types[type]
    if (Array.isArray(struct)) {
        // The readers resolve an array-looking name first, so they would show this struct empty.
        if (type.endsWith(']') || !isRecord(value) || Array.isArray(value)) {
            return true
        }
        // viem hashes `value[name]` for any declared field, so an entry the walk
        // cannot follow by name and type must be refused, not skipped.
        return struct.some(
            field =>
                !isRecord(field) ||
                typeof field.name !== 'string' ||
                typeof field.type !== 'string' ||
                isUnreadable(types, field.type, value[field.name]),
        )
    }
    if (type.endsWith(']')) {
        const element = arrayRegex.exec(type)?.[1]
        if (!element || !Array.isArray(value)) return true
        return value.some(item => isUnreadable(types, element, item))
    }
    if (type.startsWith('uint') || type.startsWith('int')) {
        return (
            !integerRegex.test(type) ||
            readTypedDataInteger(value) === undefined
        )
    }
    if (type === 'bool') return typeof value !== 'boolean'
    if (type === 'address') return typeof value !== 'string'
    return false
}

/**
 * Whether the document holds an integer, bool or address, or a struct or
 * array, in a JS shape other than its declared type takes. Judged against the
 * declared schema only; `string` and `bytes` leaves are not looked at. Never
 * throws: a document that throws while being read counts as unreadable, and so
 * does a field entry without a string name and type, or a non-standard type name.
 */
export const hasUnreadableTypedDataValue = (typedData: unknown): boolean => {
    try {
        if (
            !isRecord(typedData) ||
            !isRecord(typedData.types) ||
            typeof typedData.primaryType !== 'string'
        ) {
            return false
        }
        const domain = isRecord(typedData.domain) ? typedData.domain : {}
        // A dApp-declared `EIP712Domain` wins, as it does in viem's `hashTypedData`.
        const types = {
            EIP712Domain: getTypesForEIP712Domain({ domain }),
            ...(typedData.types as Types),
        }
        return (
            isUnreadable(types, 'EIP712Domain', domain) ||
            isUnreadable(types, typedData.primaryType, typedData.message)
        )
    } catch {
        return true
    }
}
