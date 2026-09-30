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

import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import { Networks } from '@perawallet/wallet-core-config'
import type {
    DappRequestChainAdapter,
    WalletOperationResult,
} from '@perawallet/wallet-core-connections'
import { encodeToBase64, type Nullable } from '@perawallet/wallet-core-shared'
import {
    arc60WireSchema,
    assertArc60RequestWithinLimits as assertArc60WireRequestWithinLimits,
} from '@perawallet/wallet-core-signing'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing/constants'
import { algorandDescriptor } from '../descriptor'

/**
 * CAIP-2 chain ids, which only WalletConnect v2 speaks — v1 has no concept of
 * them.
 */
export const ALGORAND_CAIP2_NAMESPACE = 'algorand'

// The descriptor already carries each network's CAIP-2 id (the URL-safe first
// 32 characters of its genesis hash); `custom` is left out of it on purpose,
// since a custom node's genesis is user data with no id until probed, so
// lookups here fail closed to `null` for it the same way.
const caip2ChainIdFor = (networkId: NetworkId): Nullable<string> =>
    algorandDescriptor.networks.find(network => network.id === networkId)
        ?.caip2 ?? null

/** The network a chain id names, or null for one that names none of ours. */
const networkForCaip2ChainId = (caip2: string): Nullable<NetworkId> =>
    algorandDescriptor.networks.find(network => network.caip2 === caip2)
        ?.id ?? null

/**
 * Mirrors `AlgorandWalletConnectChainId` in
 * `@perawallet/wallet-core-walletconnect`. Duplicated, not imported: this
 * package must never depend on walletconnect (the dependency runs the other
 * way, through the dApp request adapter), so the numbers are pinned together
 * instead by walletconnect's own `v1ChainIdParity.spec.ts`.
 */
const ALGORAND_WC_V1_CHAIN_ID = {
    mainnet: 416_001,
    testnet: 416_002,
    betanet: 416_003,
    all: 4160,
} as const

/**
 * `custom` borrows TestNet's id because a dApp needs some chain id to open a
 * session at all; the resolver's own genesis check still rejects a mismatch
 * at submit time, so this never decides what gets signed.
 */
const EXPECTED_V1_CHAIN_ID_BY_NETWORK: ReadonlyMap<NetworkId, number> =
    new Map([
        [Networks.mainnet, ALGORAND_WC_V1_CHAIN_ID.mainnet],
        [Networks.testnet, ALGORAND_WC_V1_CHAIN_ID.testnet],
        [Networks.betanet, ALGORAND_WC_V1_CHAIN_ID.betanet],
        [Networks.custom, ALGORAND_WC_V1_CHAIN_ID.testnet],
    ])

const getExpectedV1ChainId = (networkId: NetworkId): Nullable<number> =>
    EXPECTED_V1_CHAIN_ID_BY_NETWORK.get(networkId) ?? null

/**
 * The 4160 wildcard ("any Algorand chain") is acceptable on any network we
 * have an id for; an explicit id must match exactly. A missing chain id, or a
 * network with no expected id, is rejected rather than guessed.
 */
const isV1ChainIdAcceptable = (
    chainId: number | undefined,
    networkId: NetworkId,
): boolean => {
    if (chainId === undefined) return false
    const expected = getExpectedV1ChainId(networkId)
    if (expected === null) return false
    if (chainId === ALGORAND_WC_V1_CHAIN_ID.all) return true
    return chainId === expected
}

// The 4160 wildcard expands to every network, and TestNet's id also covers `custom`.
const v1NetworksFor = (chainId: number): NetworkId[] =>
    Object.values(Networks).filter(network =>
        isV1ChainIdAcceptable(chainId, network),
    )

type WalletTxnEntry = { txn?: unknown; signers?: unknown }

/**
 * Deliberately does not decode the msgpack `txn` for its sender: multisig,
 * authAddr and rekey make a naive `snd` read wrong, and that is ARC-0001
 * resolution's job. An empty result means "cannot tell", not "nobody".
 */
const namedSigners = (entries: WalletTxnEntry[]): string[] =>
    entries.flatMap(entry =>
        Array.isArray(entry.signers)
            ? entry.signers.filter(
                  (value): value is string => typeof value === 'string',
              )
            : [],
    )

const screenTransactionRequest = (
    params: unknown,
    knownAddresses: readonly string[],
): { ok: true } | { ok: false; reason: string } => {
    if (!Array.isArray(params) || params.length === 0) {
        return { ok: false, reason: 'empty or non-array transaction list' }
    }
    if (params.length > MAX_TRANSACTION_SIGN_REQUESTS) {
        return { ok: false, reason: 'too many transactions in one request' }
    }
    const entries = params as WalletTxnEntry[]
    if (entries.some(entry => typeof entry?.txn !== 'string')) {
        return { ok: false, reason: 'transaction entry without a txn string' }
    }
    // Conservative: only reject when the request names signers and none of
    // them is ours. Naming nothing is deferred to the pipeline.
    const named = namedSigners(entries)
    if (named.length > 0) {
        const known = new Set(knownAddresses)
        if (!named.some(address => known.has(address))) {
            return { ok: false, reason: 'no named signer belongs to this wallet' }
        }
    }
    return { ok: true }
}

const screenDataRequest = (
    params: unknown,
): { ok: true } | { ok: false; reason: string } => {
    try {
        assertArc60WireRequestWithinLimits(params)
    } catch (error) {
        return {
            ok: false,
            reason: `Invalid ARC-60 sign request payload — ${
                error instanceof Error ? error.message : 'size cap exceeded'
            }`,
        }
    }
    // Structural shape only; canonification and signer authorization stay in the pipeline.
    const parsed = arc60WireSchema.safeParse(params)
    if (!parsed.success) return { ok: false, reason: 'ARC-60 payload failed schema' }
    return { ok: true }
}

/**
 * The JSON-RPC `result` an operation answers with. Both v1 and v2 put the
 * same value on the wire: ARC-0001's response is the slot-ordered
 * `Nullable<string>[]`, one entry per transaction the request named, and
 * ARC-60's is the signatures base64-encoded.
 */
const toWireResult = (result: WalletOperationResult): unknown =>
    result.type === 'sign-transactions'
        ? result.signed
        : result.signatures.map(signature => encodeToBase64(signature))

/** Algorand's `DappRequestChainAdapter.walletConnect` member. */
export const algorandWalletConnectSupport: DappRequestChainAdapter['walletConnect'] =
    {
        namespace: ALGORAND_CAIP2_NAMESPACE,
        caip2ChainIdFor,
        networkForCaip2ChainId,
        toWireResult,
        v1: {
            isChainIdAcceptable: isV1ChainIdAcceptable,
            networksFor: v1NetworksFor,
            screenRequest: (type, params, knownAddresses) =>
                type === 'sign-transactions'
                    ? screenTransactionRequest(params, knownAddresses)
                    : screenDataRequest(params),
        },
    }
