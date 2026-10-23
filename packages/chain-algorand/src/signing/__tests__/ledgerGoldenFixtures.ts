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

import { Buffer } from 'buffer'
import nacl from 'tweetnacl'
import { Address } from 'algosdk'
import type { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletRegistry,
    HardwareWalletTransport,
} from '@perawallet/wallet-extension-hardware-wallet'
import type {
    AnalyzedSignableGroup,
    SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { groupTransactions } from '../../blockchain'
import { createAlgorandLedgerTransport } from '../../ledger/transport'
import { hardwareAccount } from '../../__tests__/algorandAccounts'
import { generateMultisigAddress } from '../../multisig/address'
import type { AlgorandTransactionPayload } from '../planner'
import {
    MAINNET_GENESIS_HASH,
    asUnsignedAlgorandTransaction,
    makeTestPaymentTx,
} from './transactions'
import type { PeraTransaction } from '../../blockchain/models/algosdk-shapes'

const keyPairOf = (byte: number): nacl.SignKeyPair =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))
const addressOf = (keys: nacl.SignKeyPair): string =>
    new Address(keys.publicKey).toString()
const fixedAddress = (byte: number): Address =>
    new Address(new Uint8Array(32).fill(byte))

export const LEDGER_KEYS = keyPairOf(7)
export const LEDGER_ADDRESS = addressOf(LEDGER_KEYS)
const PARTNER_ADDRESS = addressOf(keyPairOf(8))
const OTHER = fixedAddress(9)
const RECEIVER = fixedAddress(10)
const REKEYED_SENDER = fixedAddress(11)

export const ledger: WalletAccount = hardwareAccount(LEDGER_ADDRESS)

const MULTISIG = {
    version: 1,
    threshold: 2,
    addresses: [LEDGER_ADDRESS, PARTNER_ADDRESS],
}
const MULTISIG_ADDRESS = generateMultisigAddress(
    MULTISIG.version,
    MULTISIG.threshold,
    MULTISIG.addresses,
)

const TX_PREFIX = new TextEncoder().encode('TX')

/** A Ledger that signs as the Algorand app does: over the prefixed bytes it is handed. */
export const createFakeAlgorandLedger = () => {
    const received: Uint8Array[] = []
    const transport: HardwareWalletTransport = {
        getAddress: async accountIndex => ({
            address: LEDGER_ADDRESS,
            publicKey: LEDGER_KEYS.publicKey,
            accountIndex,
        }),
        signTransaction: async (_accountIndex, payload) => {
            received.push(payload)
            const prefixed = new Uint8Array(TX_PREFIX.length + payload.length)
            prefixed.set(TX_PREFIX)
            prefixed.set(payload, TX_PREFIX.length)
            return nacl.sign.detached(prefixed, LEDGER_KEYS.secretKey)
        },
        signMessage: async () => new Uint8Array(64),
        getAppVersion: async () => ({ major: 2, minor: 0, patch: 0 }),
        disconnect: async () => undefined,
    }
    const registry = {
        getProvider: () => ({ connect: async () => transport }),
    } as unknown as HardwareWalletRegistry
    return { registry, received }
}

type AppCall = { method: string; args: unknown[] }

/**
 * The Algorand app under the real Algorand Ledger transport, so what it
 * records sits below the chain-neutral transport interface.
 */
export const createFakeAlgorandApp = (
    version = { major: 2, minor: 0, patch: 0 },
) => {
    const calls: AppCall[] = []
    const record = <T>(method: string, args: unknown[], result: T): T => {
        calls.push({ method, args })
        return result
    }
    const app = {
        getVersion: async () => record('getVersion', [], version),
        getAddressAndPubKey: async (...args: unknown[]) =>
            record('getAddressAndPubKey', args, {
                address: Buffer.from(LEDGER_ADDRESS),
                publicKey: Buffer.from(LEDGER_KEYS.publicKey),
            }),
        signData: async (...args: unknown[]) =>
            record('signData', args, { signature: Buffer.alloc(64, 1) }),
    } as unknown as AlgorandApp
    const transport = createAlgorandLedgerTransport(
        { close: async () => undefined },
        app,
    )
    const registry = {
        getProvider: () => ({ connect: async () => transport }),
    } as unknown as HardwareWalletRegistry
    return { registry, calls }
}

const payment = (sender: Address | string, amount: bigint): PeraTransaction =>
    makeTestPaymentTx(
        typeof sender === 'string' ? Address.fromString(sender) : sender,
        { receiver: RECEIVER, amount, genesisHash: MAINNET_GENESIS_HASH },
    )

const groupOf = (
    transactions: PeraTransaction[],
    payloads: Omit<AlgorandTransactionPayload, 'transaction'>[],
    signerAddress: string,
    source: SourceMetadata = { type: 'local' },
): AnalyzedSignableGroup => ({
    source,
    signerAddress,
    originalIndices: transactions.map((_, index) => index),
    analysis: {
        totalFees: 0n,
        warnings: [],
        signableAddresses: [LEDGER_ADDRESS],
        riskLevel: 'low',
    },
    data: {
        type: 'transactions',
        transactions: transactions.map((transaction, index) =>
            asUnsignedAlgorandTransaction(transaction, payloads[index]),
        ),
        chainData: {
            algorand: { indicesToSign: transactions.map((_, i) => i) },
        },
    },
})

const atomic = groupTransactions([
    payment(LEDGER_ADDRESS, 1n),
    payment(OTHER, 2n),
    payment(LEDGER_ADDRESS, 3n),
])

const swap = groupTransactions([
    payment(LEDGER_ADDRESS, 4n),
    payment(OTHER, 5n),
    payment(LEDGER_ADDRESS, 6n),
    payment(OTHER, 7n),
])

/** Each case is the group the hardware signer receives for one kind of Ledger request. */
export const LEDGER_CASES = {
    single: groupOf([payment(LEDGER_ADDRESS, 1n)], [{}], LEDGER_ADDRESS),
    group: groupOf([atomic[0], atomic[2]], [{}, {}], LEDGER_ADDRESS),
    rekeyed: groupOf(
        [payment(REKEYED_SENDER, 1n)],
        [{ authorizer: LEDGER_ADDRESS }],
        REKEYED_SENDER.toString(),
    ),
    swap: groupOf([swap[0], swap[2]], [{}, {}], LEDGER_ADDRESS),
    cosign: groupOf(
        [payment(MULTISIG_ADDRESS, 1n)],
        [{ multisig: MULTISIG }],
        LEDGER_ADDRESS,
        { type: 'multisig-cosign', signRequestId: 'sign-request-1' },
    ),
} as const
