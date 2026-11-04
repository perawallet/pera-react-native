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
import {
    decodeFunctionData,
    encodeFunctionData,
    getAddress,
    size,
    slice,
    stringToHex,
    toFunctionSelector,
    toFunctionSignature,
} from 'viem'
import type { AbiFunction, AbiParameter, Hex } from 'viem'
import {
    hasUnprintableChars,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { isRecord } from '../signing/adapter'
import type {
    EvmAbiArgument,
    EvmAbiValue,
    EvmVerifiedAbi,
    EvmVerifiedCall,
} from './types'

const SELECTOR_SIZE = 4
const ARRAY_SUFFIX = /\[\d*\]$/
// Soft hyphens, tag characters and the like render as nothing.
const FORMAT_CHARS = /\p{Cf}/u

const isFunctionItem = (item: unknown): item is AbiFunction =>
    isRecord(item) &&
    item.type === 'function' &&
    typeof item.name === 'string' &&
    Array.isArray(item.inputs)

const signatureOf = (item: AbiFunction): Optional<string> => {
    try {
        return toFunctionSignature(item)
    } catch {
        return undefined
    }
}

const selectorOf = (item: AbiFunction): Optional<string> => {
    try {
        return toFunctionSelector(item).toLowerCase()
    } catch {
        return undefined
    }
}

const isPrintable = (text: string): boolean =>
    !hasUnprintableChars(text) && !FORMAT_CHARS.test(text)

// Names come from the backend, not the calldata, so they get the same
// scrutiny a string argument does before reaching a signing screen.
const hasPrintableNames = (params: readonly AbiParameter[]): boolean =>
    params.every(
        param =>
            isPrintable(param.name ?? '') &&
            (!('components' in param) || hasPrintableNames(param.components)),
    )

const valueOf = (param: AbiParameter, value: unknown): EvmAbiValue => {
    const { type } = param
    if (ARRAY_SUFFIX.test(type)) {
        const element = { ...param, type: type.replace(ARRAY_SUFFIX, '') }
        return {
            kind: 'array',
            items: (value as readonly unknown[]).map(item =>
                valueOf(element, item),
            ),
        }
    }
    if (type === 'tuple' && 'components' in param) {
        return { kind: 'tuple', fields: argumentsOf(param.components, value) }
    }
    if (type === 'address') {
        return { kind: 'address', value: getAddress(value as string) }
    }
    if (type === 'bool') return { kind: 'bool', value: value as boolean }
    if (type.startsWith('uint') || type.startsWith('int')) {
        return { kind: 'integer', value: new Decimal(String(value)) }
    }
    if (type.startsWith('bytes')) return { kind: 'bytes', value: value as Hex }
    if (type === 'string') {
        const text = value as string
        return isPrintable(text)
            ? { kind: 'string', value: text }
            : { kind: 'bytes', value: stringToHex(text) }
    }
    throw new Error(`Unsupported ABI type: ${type}`)
}

// viem returns a tuple as an object only when every component is named.
const argumentsOf = (
    params: readonly AbiParameter[],
    values: unknown,
): EvmAbiArgument[] =>
    params.map((param, index) => ({
        ...(param.name && { name: param.name }),
        type: param.type,
        value: valueOf(
            param,
            Array.isArray(values)
                ? values[index]
                : (values as Record<string, unknown>)[param.name ?? ''],
        ),
    }))

/**
 * The call `data` makes, read under the single function of the verified ABI
 * whose selector it carries, or undefined unless the decoded arguments
 * re-encode to exactly `data`: a wrong name on a signing screen is worse than
 * none.
 */
export const decodeEvmVerifiedCall = (
    data: Hex,
    answer: EvmVerifiedAbi,
): Optional<EvmVerifiedCall> => {
    if (size(data) < SELECTOR_SIZE) return undefined
    const selector = slice(data, 0, SELECTOR_SIZE).toLowerCase()
    const candidates = answer.abi
        .filter(isFunctionItem)
        .filter(item => selectorOf(item) === selector)
    const signatures = new Set(candidates.map(signatureOf))
    const [signature] = signatures
    const [item] = candidates
    if (
        signatures.size !== 1 ||
        !signature ||
        !item ||
        !isPrintable(item.name) ||
        !hasPrintableNames(item.inputs)
    ) {
        return undefined
    }
    try {
        const { args = [] } = decodeFunctionData({ abi: [item], data })
        const reencoded = encodeFunctionData({
            abi: [item],
            functionName: item.name,
            args,
        })
        if (reencoded.toLowerCase() !== data.toLowerCase()) return undefined
        return {
            functionName: item.name,
            signature,
            arguments: argumentsOf(item.inputs, args),
            ...(answer.proxy && { proxy: answer.proxy }),
        }
    } catch {
        return undefined
    }
}
