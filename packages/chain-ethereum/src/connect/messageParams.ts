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

import { isAddress, isHex, stringToHex } from 'viem'
import type {
    DappMessageRequest,
    DappRequestChainAdapter,
    DappRequestValidation,
} from '@perawallet/wallet-core-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    areEvmAddressesEqual,
    normalizeEvmAddress,
} from '../accounts/address-codec'
import { isRecord } from '../signing/adapter'
import { isPermitTypedData } from '../signing/permits'
import {
    parseDomainChainId,
    type EthereumPersonalSignPayload,
} from '../signing/messages'
import { ETHEREUM_WC_V2_METHOD } from './walletConnect'

type MessageValidation = DappRequestValidation<DappMessageRequest>
type Refusal = Extract<MessageValidation, { ok: false }>

// `plan` hashes and the review renders the whole payload on the JS thread, so
// a session dApp's oversized one is refused before either sees it.
export const MAX_MESSAGE_LENGTH = 64 * 1024
export const MAX_TYPED_DATA_NODES = 2048
export const MAX_TYPED_DATA_DEPTH = 32

const invalid = (message: string): Refusal => ({
    ok: false,
    failure: 'invalid-params',
    message,
})

// Non-strict: a lowercase address is common, and its missing checksum is not a refusal.
const addressOf = (value: unknown): Optional<string> =>
    typeof value === 'string' && isAddress(value, { strict: false })
        ? normalizeEvmAddress(value)
        : undefined

const signerOf = (
    value: unknown,
    authorizedAccounts: readonly string[],
    usage: string,
): { ok: true; signer: string } | Refusal => {
    const signer = addressOf(value)
    if (signer === undefined) return invalid(usage)
    if (
        !authorizedAccounts.some(account =>
            areEvmAddressesEqual(account, signer),
        )
    ) {
        return {
            ok: false,
            failure: 'unauthorized-account',
            message: 'The signer is not an account of this session',
        }
    }
    return { ok: true, signer }
}

// `0x` plus whole bytes is the bytes themselves; anything else is text.
const messageHexOf = (message: string): `0x${string}` =>
    isHex(message, { strict: true }) && message.length % 2 === 0
        ? message
        : stringToHex(message)

const parseTypedData = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return undefined
    }
}

// Iterative and early-out, so a hostile document costs at most the budget.
const isWithinTypedDataBudget = (root: unknown): boolean => {
    const stack: { value: unknown; depth: number }[] = [
        { value: root, depth: 0 },
    ]
    let nodes = 0
    for (let next = stack.pop(); next; next = stack.pop()) {
        const { value, depth } = next
        nodes += 1
        if (nodes > MAX_TYPED_DATA_NODES || depth > MAX_TYPED_DATA_DEPTH) {
            return false
        }
        if (typeof value === 'object' && value !== null) {
            for (const child of Object.values(value)) {
                stack.push({ value: child, depth: depth + 1 })
            }
        }
    }
    return true
}

const validatePersonalSign = (
    params: readonly unknown[],
    authorizedAccounts: readonly string[],
): MessageValidation => {
    const usage = 'personal_sign expects [message, address]'
    const [message, address] = params
    if (typeof message !== 'string') return invalid(usage)
    if (message.length > MAX_MESSAGE_LENGTH) {
        return invalid('personal_sign message is too long')
    }
    const signer = signerOf(address, authorizedAccounts, usage)
    if (!signer.ok) return signer
    return {
        ok: true,
        request: {
            method: ETHEREUM_WC_V2_METHOD.personalSign,
            signer: signer.signer,
            payload: {
                message: messageHexOf(message),
            } satisfies EthereumPersonalSignPayload,
        },
    }
}

export type EthereumMessageSession = { eip155ChainId: Optional<number> }

const hasDomainChainId = (typedData: Record<string, unknown>): boolean =>
    isRecord(typedData.domain) && typedData.domain.chainId !== undefined

// A malformed chainId counts as another chain: `plan` would refuse it later.
const isBoundToOtherChain = (
    typedData: Record<string, unknown>,
    session: EthereumMessageSession,
): boolean => {
    const { domain } = typedData
    if (!isRecord(domain) || domain.chainId === undefined) return false
    if (session.eip155ChainId === undefined) return true
    try {
        return (
            parseDomainChainId(domain.chainId) !== BigInt(session.eip155ChainId)
        )
    } catch {
        return true
    }
}

const validateSignTypedData = (
    params: readonly unknown[],
    authorizedAccounts: readonly string[],
    session: EthereumMessageSession,
): MessageValidation => {
    const [address, rawTypedData] = params
    const signer = signerOf(
        address,
        authorizedAccounts,
        'eth_signTypedData_v4 expects [address, typedData]',
    )
    if (!signer.ok) return signer
    if (
        typeof rawTypedData === 'string' &&
        rawTypedData.length > MAX_MESSAGE_LENGTH
    ) {
        return invalid('eth_signTypedData_v4 typedData is too large')
    }
    const typedData = parseTypedData(rawTypedData)
    if (!isRecord(typedData) || Array.isArray(typedData)) {
        return invalid('eth_signTypedData_v4 typedData is not an object')
    }
    if (!isWithinTypedDataBudget(typedData)) {
        return invalid('eth_signTypedData_v4 typedData is too large')
    }
    if (isBoundToOtherChain(typedData, session)) {
        return invalid(
            'eth_signTypedData_v4 domain chainId is not the connected chain',
        )
    }
    // Signed without a chain, a permit is valid on every chain whose token
    // leaves the chain out of its domain separator.
    if (!hasDomainChainId(typedData) && isPermitTypedData(typedData)) {
        return invalid('eth_signTypedData_v4 permit domain names no chainId')
    }
    return {
        ok: true,
        request: {
            method: ETHEREUM_WC_V2_METHOD.signTypedDataV4,
            signer: signer.signer,
            // The shape is left to the message signer's `plan`.
            payload: { typedData },
        },
    }
}

export const validateEthereumMessagePayload = (
    type: Parameters<
        NonNullable<DappRequestChainAdapter['validateMessagePayload']>
    >[0],
    params: unknown,
    authorizedAccounts: readonly string[],
    session: EthereumMessageSession,
): MessageValidation => {
    if (!Array.isArray(params)) {
        return invalid('Message params must be an array')
    }
    const positional: unknown[] = params
    return type === 'sign-message'
        ? validatePersonalSign(positional, authorizedAccounts)
        : validateSignTypedData(positional, authorizedAccounts, session)
}
