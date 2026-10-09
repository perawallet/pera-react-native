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

// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Address, SignedTransaction } from 'algosdk'
import { generateKey } from 'falcon-1024'
import {
    accountsChainAdapters,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { algorandAccountsAdapter } from '../../accounts/adapter'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import { groupTransactions } from '../../blockchain'
import { findFundedIndices, type SimulateSignedGroup } from '../feeCoverage'
import { makeTestAddress, makeTestPaymentTx } from './transactions'

const pq = vi.hoisted(() => ({
    resolve: (): unknown => null,
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    resolvePQSigningInfo: () => pq.resolve(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: [] } }),
}))

// Signer resolution reads the selected network through the provider, which
// this node environment can't load.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

const { publicKey: PQ_PUBLIC_KEY } = generateKey(new Uint8Array(48).fill(5))
const quantumAddress = makeTestAddress(1)
const algoAddress = makeTestAddress(2)
const externalAddress = makeTestAddress(3)

const quantum = (): WalletAccount =>
    ({
        address: quantumAddress.toString(),
        custody: { kind: 'local', seed: 'quantum' },
        keyPairId: 'kp-quantum',
    }) as WalletAccount

const algo25 = (rekeyAddress?: string): WalletAccount =>
    ({
        address: algoAddress.toString(),
        custody: { kind: 'local', seed: 'algo25' },
        keyPairId: 'kp-algo25',
        ...(rekeyAddress ? { rekeyAddress } : {}),
    }) as WalletAccount

const payment = (sender: Address): PeraTransaction =>
    makeTestPaymentTx(sender, { receiver: makeTestAddress(9), amount: 1n })

const grouped = (...txns: PeraTransaction[]): PeraTransaction[] => {
    groupTransactions(txns)
    return txns
}

const passing = () => vi.fn<SimulateSignedGroup>(async () => null)

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    pq.resolve = () => ({ schemeId: 'falcon1024', publicKey: PQ_PUBLIC_KEY })
})

describe('findFundedIndices', () => {
    test('reports a quantum partition algod accepts, simulated with a pqsig shape', async () => {
        const transactions = [payment(quantumAddress)]
        const simulate = passing()

        const funded = await findFundedIndices({
            transactions,
            signableIndices: [0],
            accounts: [quantum()],
            network: 'testnet',
            simulate,
        })

        expect([...funded]).toEqual([0])
        const [[group]] = simulate.mock.calls
        expect(group[0].pqsig?.pk).toEqual(PQ_PUBLIC_KEY)
        expect(group[0].pqsig?.sig).toHaveLength(0)
        expect(group[0].sgnr).toBeUndefined()
    })

    test('does not report a partition algod rejects', async () => {
        const simulate = vi.fn<SimulateSignedGroup>(
            async () => 'txgroup with 1mA fees is less than 3mA',
        )

        const funded = await findFundedIndices({
            transactions: [payment(quantumAddress)],
            signableIndices: [0],
            accounts: [quantum()],
            network: 'testnet',
            simulate,
        })

        expect(funded.size).toBe(0)
    })

    test('shapes a rekeyed sender as its quantum authority, sgnr included', async () => {
        const simulate = passing()

        await findFundedIndices({
            transactions: [payment(algoAddress)],
            signableIndices: [0],
            accounts: [algo25(quantumAddress.toString()), quantum()],
            network: 'testnet',
            simulate,
        })

        const [[group]] = simulate.mock.calls
        const [stxn]: SignedTransaction[] = group
        expect(stxn.pqsig).toBeDefined()
        expect(stxn.sgnr?.toString()).toBe(quantumAddress.toString())
    })

    test('simulates only fully signable partitions with a quantum signer', async () => {
        const transactions = [
            ...grouped(payment(quantumAddress), payment(externalAddress)),
            payment(algoAddress),
        ]
        const simulate = passing()

        const funded = await findFundedIndices({
            transactions,
            signableIndices: [0, 2],
            accounts: [quantum(), algo25()],
            network: 'testnet',
            simulate,
        })

        expect(simulate).not.toHaveBeenCalled()
        expect(funded.size).toBe(0)
    })

    test('never reports a partition whose quantum key it cannot describe', async () => {
        pq.resolve = () => {
            throw new Error('keystore unavailable')
        }
        const simulate = passing()

        const funded = await findFundedIndices({
            transactions: [payment(quantumAddress)],
            signableIndices: [0],
            accounts: [quantum()],
            network: 'testnet',
            simulate,
        })

        // An ed25519 guess would under-price the signer and pass.
        expect(simulate).not.toHaveBeenCalled()
        expect(funded.size).toBe(0)
    })

    test('reports nothing when simulation fails or times out', async () => {
        const params = {
            transactions: [payment(quantumAddress)],
            signableIndices: [0],
            accounts: [quantum()],
            network: 'testnet' as const,
        }

        const failed = await findFundedIndices({
            ...params,
            simulate: async () => {
                throw new Error('algod unreachable')
            },
        })
        const timedOut = await findFundedIndices({
            ...params,
            simulate: () => new Promise(() => {}),
            timeoutMs: 5,
        })

        expect(failed.size).toBe(0)
        expect(timedOut.size).toBe(0)
    })
})
