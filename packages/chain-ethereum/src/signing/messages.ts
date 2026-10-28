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
    bytesToHex,
    getAddress,
    getTypesForEIP712Domain,
    hexToBytes,
    isAddress,
    isHex,
    recoverAddress,
    serializeSignature,
    toHex,
    validateTypedData,
} from 'viem'
import type { Hex, TypedDataDefinition, TypedDataParameter } from 'viem'
import {
    chainAccountOf,
    isHardwareWalletAccount,
    signingKeyOn,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainScope,
    type MessageRequest,
    type MessageSummary,
    type MessageTreeNode,
    type Signature,
    type SignedMessage,
    type SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import { decodePrintableUtf8 } from '@perawallet/wallet-core-shared'
import {
    CannotSignError,
    type MessagePlanContext,
    type MessageSignKind,
    type MessageSignerChainAdapter,
    type ReviewedAddress,
    type ReviewedAddressRole,
} from '@perawallet/wallet-core-signing'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { ETHEREUM_WC_V2_METHOD } from '../connect/walletConnect'
import {
    encodeEthereumLedgerMessage,
    typedDataLedgerMessage,
    type EthereumLedgerMessageBody,
} from '../ledger/messagePayload'
import { isRecord } from './adapter'
import {
    openTaggedDigest,
    personalMessageDigest,
    typedDataDigest,
    type TaggedDigest,
} from './digests'
import { spendApprovalOf } from './permits'
import { toViemSignature } from './sign'

/** The `MessageRequest.payload` for `personal_sign`. */
export type EthereumPersonalSignPayload = {
    /** The exact bytes signed, before the EIP-191 prefix. */
    message: Hex
}

/** The `MessageRequest.payload` for `eth_signTypedData_v4`. */
export type EthereumTypedDataPayload = {
    /** The EIP-712 v4 object as the dApp sent it, JSON-parsed. */
    typedData: TypedDataDefinition
}

const PERSONAL_SIGN = ETHEREUM_WC_V2_METHOD.personalSign
const SIGN_TYPED_DATA_V4 = ETHEREUM_WC_V2_METHOD.signTypedDataV4
const TITLE_KEY = i18nKey('signing.arbitrary_data_view.body')

export const personalSignMessageRequest = (
    scope: ChainScope,
    signer: string,
    message: Hex,
): MessageRequest => ({
    scope,
    method: PERSONAL_SIGN,
    signer,
    payload: { message } satisfies EthereumPersonalSignPayload,
})

export const typedDataMessageRequest = (
    scope: ChainScope,
    signer: string,
    typedData: unknown,
): MessageRequest => ({
    scope,
    method: SIGN_TYPED_DATA_V4,
    signer,
    payload: { typedData },
})

const supports = (method: string): boolean =>
    method === PERSONAL_SIGN || method === SIGN_TYPED_DATA_V4

const isSignableKind = (kind: MessageSignKind): boolean =>
    kind === 'message' || kind === 'typedData'

// `payload` is `unknown` and may come from a dApp, so these readers are the
// trust boundary for `describe`, `plan` and `assemble`.
const readPersonalSign = (payload: unknown): EthereumPersonalSignPayload => {
    if (
        !isRecord(payload) ||
        typeof payload.message !== 'string' ||
        !isHex(payload.message, { strict: true }) ||
        payload.message.length % 2 !== 0
    ) {
        throw new Error('The personal_sign message payload is malformed')
    }
    return { message: payload.message }
}

const MALFORMED_TYPED_DATA = 'The typed-data message payload is malformed'

export const parseDomainChainId = (chainId: unknown): bigint | undefined => {
    if (chainId === undefined) return undefined
    if (
        typeof chainId !== 'number' &&
        typeof chainId !== 'bigint' &&
        typeof chainId !== 'string'
    ) {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    try {
        return BigInt(chainId)
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
}

// When the dApp declares no `EIP712Domain`, viem derives the domain's types
// from its values and silently drops a string `chainId`, which would sign a
// domain bound to no chain. As a bigint it is typed as the uint256 the dApp
// meant. A declared `EIP712Domain` is hashed as declared, so it is left alone.
const readTypedData = (payload: unknown): TypedDataDefinition => {
    const typedData = isRecord(payload) ? payload.typedData : undefined
    if (
        !isRecord(typedData) ||
        !isRecord(typedData.types) ||
        typeof typedData.primaryType !== 'string' ||
        !isRecord(typedData.message) ||
        (typedData.domain !== undefined && !isRecord(typedData.domain))
    ) {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    // A domain-only signature hashes no message, so a review of `message`
    // would show content the signature never binds.
    if (typedData.primaryType === 'EIP712Domain') {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    const { domain, types } = typedData
    const chainId = parseDomainChainId(domain?.chainId)
    const definition = (domain &&
    chainId !== undefined &&
    types.EIP712Domain === undefined
        ? { ...typedData, domain: { ...domain, chainId } }
        : typedData) as unknown as TypedDataDefinition
    try {
        validateTypedData(definition)
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
    return definition
}

const ARRAY_TYPE = /^(.+)\[\d*\]$/

// Labels and string leaves are the dApp's text: shown as hex unless printable,
// so bidi or zero-width characters can't disguise a field in the review.
const screened = (text: string): string =>
    text === ''
        ? text
        : (decodePrintableUtf8(new TextEncoder().encode(text)) ?? toHex(text))

const leafOf = (value: unknown): string => {
    if (typeof value === 'string') return screened(value)
    if (value instanceof Uint8Array) return bytesToHex(value)
    return String(value)
}

// Walked by the schema rather than the object, so the tree shows exactly the
// fields that are hashed: a key the dApp adds outside `types` is never signed.
const fieldNode = (
    types: Record<string, readonly TypedDataParameter[]>,
    name: string,
    type: string,
    value: unknown,
): MessageTreeNode => {
    const label = screened(name)
    const element = ARRAY_TYPE.exec(type)?.[1]
    if (element !== undefined) {
        const items = Array.isArray(value) ? value : []
        return {
            label,
            children: items.map((item, index) =>
                fieldNode(types, String(index), element, item),
            ),
        }
    }
    if (types[type]) {
        return { label, children: structFields(types, type, value) }
    }
    return { label, value: leafOf(value) }
}

const structFields = (
    types: Record<string, readonly TypedDataParameter[]>,
    type: string,
    value: unknown,
): MessageTreeNode[] => {
    const record = isRecord(value) ? value : {}
    return (types[type] ?? []).map(field =>
        fieldNode(types, field.name, field.type, record[field.name]),
    )
}

const typedDataTree = (typedData: TypedDataDefinition): MessageTreeNode[] => {
    const domain = typedData.domain ?? {}
    // A dApp-supplied `EIP712Domain` wins, as it does in viem's `hashTypedData`.
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...(typedData.types as Record<string, readonly TypedDataParameter[]>),
    }
    return [
        {
            label: 'domain',
            children: structFields(types, 'EIP712Domain', domain),
        },
        {
            label: 'message',
            children: structFields(
                types,
                typedData.primaryType as string,
                typedData.message,
            ),
        },
    ]
}

const ROLE_BY_FIELD_NAME: Record<string, ReviewedAddressRole> = {
    spender: 'spender',
    operator: 'operator',
    verifyingContract: 'target',
}

// Read by the schema like the tree, so a permit the parser doesn't recognise
// (DAI's `holder/spender/expiry/allowed`, a Permit2 with no readable deadline)
// still has its spender checked.
const schemaAddresses = (
    types: Record<string, readonly TypedDataParameter[]>,
    name: string,
    type: string,
    value: unknown,
): ReviewedAddress[] => {
    const element = ARRAY_TYPE.exec(type)?.[1]
    if (element !== undefined) {
        const items = Array.isArray(value) ? value : []
        return items.flatMap(item =>
            schemaAddresses(types, name, element, item),
        )
    }
    if (types[type]) {
        const record = isRecord(value) ? value : {}
        return (types[type] ?? []).flatMap(field =>
            schemaAddresses(types, field.name, field.type, record[field.name]),
        )
    }
    if (type !== 'address') return []
    if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
        return []
    }
    return [
        {
            address: value,
            role: ROLE_BY_FIELD_NAME[name] ?? 'referenced-account',
        },
    ]
}

const typedDataAddresses = (payload: unknown): ReviewedAddress[] => {
    let typedData: TypedDataDefinition
    try {
        typedData = readTypedData(payload)
    } catch {
        return []
    }
    const domain = typedData.domain ?? {}
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...(typedData.types as Record<string, readonly TypedDataParameter[]>),
    }
    return [
        ...schemaAddresses(types, 'domain', 'EIP712Domain', domain),
        ...schemaAddresses(
            types,
            'message',
            typedData.primaryType as string,
            typedData.message,
        ),
    ]
}

const describePersonalSign = (payload: unknown): MessageSummary => {
    const title = { key: TITLE_KEY }
    let message: Hex
    try {
        ;({ message } = readPersonalSign(payload))
    } catch {
        return { kind: 'raw', title }
    }
    const text = decodePrintableUtf8(hexToBytes(message))
    return text === undefined
        ? { kind: 'raw', title, preview: message }
        : { kind: 'text', title, preview: text }
}

const describeTypedData = (
    payload: unknown,
    chain: EvmChain,
): MessageSummary => {
    const title = { key: TITLE_KEY }
    let typedData: TypedDataDefinition
    let tree: MessageTreeNode[]
    try {
        typedData = readTypedData(payload)
        tree = typedDataTree(typedData)
    } catch {
        return { kind: 'raw', title }
    }
    const spendApproval = spendApprovalOf(typedData, Date.now(), chain)
    return {
        kind: 'typed-data',
        title,
        preview: typedData.primaryType as string,
        tree,
        ...(spendApproval && { spendApproval }),
    }
}

const describeWith =
    (chain: EvmChain) =>
    (request: MessageRequest): MessageSummary => {
        if (request.method === PERSONAL_SIGN) {
            return describePersonalSign(request.payload)
        }
        if (request.method === SIGN_TYPED_DATA_V4) {
            return describeTypedData(request.payload, chain)
        }
        throw new Error(`Unsupported message method ${request.method}`)
    }

type PlannedMessage = {
    digest: TaggedDigest
    /** Only for a Ledger, which takes the message rather than its digest. */
    device?: EthereumLedgerMessageBody
}

const planTypedData = (
    request: MessageRequest,
    chain: EvmChain,
    forDevice: boolean,
): PlannedMessage => {
    const typedData = readTypedData(request.payload)
    const domainChainId = typedData.domain?.chainId
    // A signature over another chain's domain would be valid there.
    if (
        domainChainId !== undefined &&
        BigInt(domainChainId) !== BigInt(eip155ChainIdOf(request.scope, chain))
    ) {
        throw new Error(
            `The typed data is for EIP-155 chain ${domainChainId}, not ${request.scope.networkId}`,
        )
    }
    try {
        return {
            digest: typedDataDigest(typedData),
            ...(forDevice && { device: typedDataLedgerMessage(typedData) }),
        }
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
}

const planMessage = (
    request: MessageRequest,
    chain: EvmChain,
    forDevice: boolean,
): PlannedMessage => {
    if (request.method !== PERSONAL_SIGN) {
        return planTypedData(request, chain, forDevice)
    }
    const { message } = readPersonalSign(request.payload)
    return {
        digest: personalMessageDigest({ raw: message }),
        ...(forDevice && { device: { kind: 'personal', message } }),
    }
}

const planWith =
    (chain: EvmChain) =>
    (
        request: MessageRequest,
        { account }: MessagePlanContext,
    ): SigningRequest[] => {
        const ownAddress = chainAccountOf(account, chain.row.id)?.address
        const refuse = (reason: string) =>
            new CannotSignError(ownAddress ?? request.signer, reason)
        if (request.scope.chainId !== chain.row.id) {
            throw refuse(
                `not a message request for ${chain.row.displayName}: ${request.scope.chainId}`,
            )
        }
        if (!supports(request.method)) {
            throw refuse(`unsupported message method ${request.method}`)
        }
        if (!ownAddress) {
            throw refuse(`the account has no ${chain.row.displayName} address`)
        }
        if (!areEvmAddressesEqual(request.signer, ownAddress)) {
            throw refuse(`the request names ${request.signer} as its signer`)
        }
        const { digest, device } = planMessage(
            request,
            chain,
            isHardwareWalletAccount(account),
        )
        return [
            {
                requestIndex: 0,
                signer: ownAddress,
                scheme: 'secp256k1',
                payload: digest.digest,
                ...(device && {
                    devicePayload: encodeEthereumLedgerMessage({
                        ...device,
                        signer: getAddress(ownAddress),
                    }),
                }),
            },
        ]
    }

const assembleWith =
    (chain: EvmChain) =>
    async (
        request: MessageRequest,
        signatures: Signature[],
    ): Promise<SignedMessage> => {
        const [signature] = signatures
        if (
            !supports(request.method) ||
            signatures.length !== 1 ||
            signature.requestIndex !== 0 ||
            signature.scheme !== 'secp256k1' ||
            !areEvmAddressesEqual(signature.signer, request.signer)
        ) {
            throw new Error(
                'An EVM message takes exactly one secp256k1 signature, from its signer',
            )
        }
        const { tag, digest } = openTaggedDigest(
            planMessage(request, chain, false).digest,
        )
        const viemSignature = toViemSignature(signature.bytes, tag)
        // Signers label signatures with the address they were asked for, not
        // the key that signed, so only recovery proves whose signature this is.
        const recovered = await recoverAddress({
            hash: digest,
            signature: viemSignature,
        })
        if (!areEvmAddressesEqual(recovered, request.signer)) {
            throw new Error(
                `The signature recovers to ${recovered}, not the signer ${request.signer}`,
            )
        }
        return {
            scope: request.scope,
            signature: {
                ...signature,
                bytes: hexToBytes(serializeSignature(viemSignature)),
            },
        }
    }

export const createEvmMessageSignerAdapter = (
    chain: EvmChain,
): MessageSignerChainAdapter => ({
    chainId: chain.row.id,
    // A local key, or a Ledger that signs the plan's device payload.
    canSign: (account, kind) =>
        isSignableKind(kind) &&
        (signingKeyOn(account, chain.row.id) !== undefined ||
            (isHardwareWalletAccount(account) &&
                chainAccountOf(account, chain.row.id) !== undefined)),
    // Every EVM verifier recovers a secp256k1 signature.
    signsVerifiably: (_account, kind) => isSignableKind(kind),
    supports,
    describe: describeWith(chain),
    // personal_sign is free text, with no schema to say which part is an address.
    reviewedAddresses: request =>
        request.method === SIGN_TYPED_DATA_V4
            ? typedDataAddresses(request.payload)
            : [],
    plan: planWith(chain),
    assemble: assembleWith(chain),
})
