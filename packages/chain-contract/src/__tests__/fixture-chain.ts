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
import type { AddressCodec, ParsedPaymentUri } from '../contracts/address-codec'
import type {
    DiscoveryCandidate,
    KeyDerivation,
} from '../contracts/key-derivation'
import type { TransactionPlanner } from '../contracts/transaction-planner'
import type {
    ReviewedTransaction,
    ReviewWarning,
    TransactionReviewer,
} from '../contracts/transaction-reviewer'
import type {
    DeriveOpts,
    TransactionSummary,
    UnsignedTransaction,
} from '../models/domain'
import { i18nKey } from '../models/i18n'
import type { ChainId, NetworkId } from '../models/identity'

// A second chain that exists only to pressure-test the contracts: base-16
// addresses with a per-network prefix, the way bech32 chains vary theirs.
export const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId

const PREFIXES: Record<NetworkId, string> = { mainnet: 'fx', testnet: 'tfx' }
const ADDRESS = /^(fx|tfx)[0-9a-f]{40}$/
const SCHEME = 'fixturehex:'
const GAP_LIMIT = 5

const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export const fixtureCodec: AddressCodec = {
    chainId: FIXTURE_CHAIN_ID,
    fromPublicKey: (publicKey, opts) =>
        `${PREFIXES[opts.networkId]}${toHex(publicKey.subarray(0, 20))}`,
    isValid: (address, networkId) => {
        const match = ADDRESS.exec(address.toLowerCase())
        return (
            match !== null &&
            (networkId === undefined || match[1] === PREFIXES[networkId])
        )
    },
    normalize: address => address.toLowerCase(),
    areEqual: (a, b) => a.toLowerCase() === b.toLowerCase(),
    truncate: address => `${address.slice(0, 6)}...${address.slice(-4)}`,
    resembles: (a, b) =>
        !fixtureCodec.areEqual(a, b) &&
        fixtureCodec.truncate(a).toLowerCase() ===
            fixtureCodec.truncate(b).toLowerCase(),
    toPaymentUri: (address, opts) => {
        const query = new URLSearchParams()
        if (opts?.amount) query.set('amount', opts.amount.toString())
        if (opts?.assetRef) query.set('asset', opts.assetRef.assetId)
        if (opts?.label) query.set('label', opts.label)
        if (opts?.note) query.set('note', opts.note)
        const search = query.toString()
        return `${SCHEME}${address.toLowerCase()}${search ? `?${search}` : ''}`
    },
    parsePaymentUri: uri => {
        if (!uri.startsWith(SCHEME)) return undefined
        const [address, search = ''] = uri.slice(SCHEME.length).split('?')
        if (!fixtureCodec.isValid(address)) return undefined
        const query = new URLSearchParams(search)
        const parsed: ParsedPaymentUri = { address }
        const amount = query.get('amount')
        const asset = query.get('asset')
        const label = query.get('label')
        const note = query.get('note')
        if (amount) parsed.amount = new Decimal(amount)
        if (asset)
            parsed.assetRef = { chainId: FIXTURE_CHAIN_ID, assetId: asset }
        if (label) parsed.label = label
        if (note) parsed.note = note
        return parsed
    },
}

const assertScheme = (opts: DeriveOpts): void => {
    if (opts.scheme !== 'ed25519') {
        throw new Error(`fixturehex cannot derive ${opts.scheme}`)
    }
}

export const fixtureDerivation: KeyDerivation = {
    chainId: FIXTURE_CHAIN_ID,
    deriveAccount: async (kms, seedRef, account, keyIndex, opts) => {
        assertScheme(opts)
        const key = await kms.deriveFromSeed(
            seedRef,
            {
                scheme: opts.scheme,
                path: `m/44'/9999'/${account}'/0/${keyIndex}`,
                id: `${seedRef}-fx-${account}-${keyIndex}`,
            },
            'fixturehex',
        )
        return {
            ...key,
            address: fixtureCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    importRawKey: async (kms, bytes, opts) => {
        assertScheme(opts)
        const key = await kms.importRawKey(
            bytes,
            { scheme: opts.scheme, id: `raw-${toHex(bytes.subarray(0, 8))}` },
            'fixturehex',
        )
        return {
            keyPairId: key.keyPairId,
            address: fixtureCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    discover: async (kms, seedRef, probe, opts) => {
        const found: DiscoveryCandidate[] = []
        for (let keyIndex = 0, misses = 0; misses < GAP_LIMIT; keyIndex++) {
            const derived = await fixtureDerivation.deriveAccount(
                kms,
                seedRef,
                0,
                keyIndex,
                opts,
            )
            if (await probe(derived.address)) {
                const { address, keyPairId } = derived
                found.push({ account: 0, keyIndex, address, keyPairId })
                misses = 0
            } else {
                misses++
            }
        }
        return found
    },
}

/** The fixture chain's payload: who signs, and the text that is signed. */
export type FixturePayload = { signer: string; body: string }

const readFixturePayload = (
    transaction: UnsignedTransaction,
): FixturePayload => {
    const { scope, payload } = transaction
    if (scope.chainId !== FIXTURE_CHAIN_ID) {
        throw new Error(`Not a fixturehex transaction: ${scope.chainId}`)
    }
    const { signer, body } = (payload ?? {}) as Partial<FixturePayload>
    if (typeof signer !== 'string' || typeof body !== 'string') {
        throw new Error('The fixturehex payload is malformed')
    }
    return { signer, body }
}

// One signature over the body's bytes, appended to them on assembly.
export const fixturePlanner: TransactionPlanner = {
    chainId: FIXTURE_CHAIN_ID,
    plan: transaction => {
        const { signer, body } = readFixturePayload(transaction)
        return [
            {
                requestIndex: 0,
                signer,
                scheme: 'ed25519',
                payload: new TextEncoder().encode(body),
                devicePayload: new TextEncoder().encode(body),
            },
        ]
    },
    assemble: (transaction, signatures) => {
        const { signer, body } = readFixturePayload(transaction)
        const [signature] = signatures
        if (
            signatures.length !== 1 ||
            signature.requestIndex !== 0 ||
            signature.scheme !== 'ed25519' ||
            !fixtureCodec.areEqual(signature.signer, signer)
        ) {
            throw new Error(
                'A fixturehex transaction takes one signature, from its signer',
            )
        }
        const bytes = new Uint8Array([
            ...new TextEncoder().encode(body),
            ...signature.bytes,
        ])
        return { scope: transaction.scope, id: toHex(bytes), bytes }
    },
}

// A body starting `call` is a contract call the fixture can't read; anything
// else is a transfer. Each transaction a held address signs costs one unit.
const CALL_PREFIX = 'call'

const fixtureSummary = (body: string): TransactionSummary =>
    body.startsWith(CALL_PREFIX)
        ? {
              kind: 'contract-call',
              title: { key: i18nKey('fixture.contract_call') },
              direction: 'none',
              icon: 'contract-call',
          }
        : {
              kind: 'transfer',
              title: { key: i18nKey('fixture.transfer') },
              direction: 'out',
              icon: 'send',
          }

// An allowlist, so a kind a future recogniser adds stays behind review until it opts in.
const isAutoApproved = (transaction: ReviewedTransaction): boolean =>
    transaction.summary.kind === 'transfer' ||
    transaction.summary.kind === 'token-transfer'

export const fixtureReviewer: TransactionReviewer = {
    chainId: FIXTURE_CHAIN_ID,
    decoder: {
        decode: async (transactions, context) => {
            const signable = new Set<string>()
            let totalFees = new Decimal(0)
            const reviewed = transactions.map(
                (transaction): ReviewedTransaction => {
                    const { signer, body } = readFixturePayload(transaction)
                    if (
                        transaction.scope.networkId !== context.scope.networkId
                    ) {
                        throw new Error(
                            `The transaction is for ${transaction.scope.networkId}, not ${context.scope.networkId}`,
                        )
                    }
                    const held = context.heldAddresses.find(address =>
                        fixtureCodec.areEqual(address, signer),
                    )
                    if (held) {
                        signable.add(held)
                        totalFees = totalFees.plus(1)
                    }
                    return {
                        summary: fixtureSummary(body),
                        native: {
                            family: transaction.chainData.family,
                            transaction: { signer, body },
                        },
                    }
                },
            )
            return {
                totalFees,
                signableAddresses: [...signable],
                transactions: reviewed,
            }
        },
    },
    warnings: {
        detect: (_transactions, decoded) =>
            decoded.signableAddresses.length === 0
                ? []
                : decoded.transactions
                      .filter(t => !isAutoApproved(t))
                      .map((): ReviewWarning => ({
                          type: 'unknown-contract',
                          severity: 'warning',
                          message: 'The fixture cannot read this call.',
                      })),
    },
    policy: {
        autoApproveLocal: review => review.transactions.every(isAutoApproved),
    },
}
