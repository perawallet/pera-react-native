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

import { microAlgo } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
    accountsChainAdapters,
    hydrateAccountChainStates,
    isWatchAccount,
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { FALLBACK_PQ_MULTIPLIER } from '@perawallet/wallet-core-chain-algorand/blockchain/constants'
import { calculateMinTxnFee } from '@perawallet/wallet-core-chain-algorand/blockchain/fees/feeCalculator'
import { encodeSignedTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain/utils/transact'
import { signTransactionsWithLocalKey } from '@perawallet/wallet-core-chain-algorand/signing/local-key/signTransactionsWithLocalKey'
import {
    LEGACY_CHAIN_ID,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { Networks } from '@perawallet/wallet-core-config'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { resolveSigningAccount } from '@perawallet/wallet-core-signing/machine/utils/resolveSigningAccount'

import {
    createAlgo25Account,
    createHdAccount,
    createQuantumAccount,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import {
    buildTxn,
    localKeySigningDeps,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { authAddrOf, getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { localNetScope } from '../../harness/scope'
import {
    STORE_FIXTURES,
    type FixtureAccounts,
    type PersistedPayload,
} from './fixtures'

const STORE_KEY = 'accounts-store'
const LEGACY_RECORD_FIELDS = [
    'type',
    'provenance',
    'credentials',
    'rekeyAddress',
    'rekeyAddressByNetwork',
]

type PersistedRecord = Record<string, unknown> & { address: string }
type PersistedState = {
    accounts: PersistedRecord[]
    authorities?: Record<string, Record<string, string>>
    unscopedAuthorities?: Record<string, string>
}

// The store's own persist storage: the platform key-value store, JSON-encoded
// the way every version wrote it.
const storage = () => {
    const persistStorage = useAccountsStore.persist.getOptions().storage
    if (!persistStorage) throw new Error('the accounts store is not persisted')
    return persistStorage
}

const readPersisted = (): PersistedState =>
    (storage().getItem(STORE_KEY) as PersistedPayload).state as PersistedState

/**
 * A store migration must leave equivalent state durably present, in the same
 * write that removes the old field, so no account loses a capability — not
 * even until the next sync. Each historical payload goes through the real
 * rehydrate and hydration path against a database with no synced rows, then
 * through two cold starts, and after every step the accounts must still sign
 * as they did: a local key for itself, the rekeyed account through its
 * authority, with LocalNet as the judge.
 */
describe('accounts-store migration conformance', () => {
    let scope: ChainScope
    let baseMinFee: bigint
    let keyStore: ConformanceKeyStore
    let algo25: ConformanceAccount
    let hd: ConformanceAccount
    let quantum: ConformanceAccount
    let rekeyed: ConformanceAccount
    let fixtureAccounts: FixtureAccounts

    beforeAll(async () => {
        scope = await localNetScope()
        // A user on LocalNet has the custom network selected, which is the
        // scope a lone scalar authority settles under.
        useNetworkStore.getState().setNetwork(Networks.custom)
        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        baseMinFee = BigInt(minFee)

        keyStore = await createConformanceKeyStore()
        algo25 = await createAlgo25Account(keyStore)
        hd = await createHdAccount(keyStore)
        quantum = await createQuantumAccount(keyStore)
        rekeyed = await createAlgo25Account(keyStore)
        for (const account of [algo25, hd, quantum, rekeyed]) {
            await fundAccount(account.address, 5_000_000n)
        }

        const rekeyTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: rekeyed.address,
                receiver: rekeyed.address,
                amount: microAlgo(0n),
                rekeyTo: algo25.address,
            })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, rekeyed, rekeyTxn),
        )
        if ((await authAddrOf(rekeyed.address)) !== algo25.address) {
            throw new Error('setup failed: the rekey did not land on LocalNet')
        }

        const held = (account: ConformanceAccount) => ({
            id: account.walletAccount.id,
            address: account.address,
            keyPairId: account.keyId,
        })
        fixtureAccounts = {
            algo25: held(algo25),
            hd: held(hd),
            quantum: held(quantum),
            rekeyed: held(rekeyed),
            watch: {
                id: crypto.randomUUID(),
                address: algosdk.generateAccount().addr.toString(),
            },
        }
    })

    // Every persisted snapshot either still carries the legacy authority on
    // the record or already holds it in the store's own maps.
    const expectAuthorityDurable = (): void => {
        const state = readPersisted()
        const record = state.accounts.find(
            ({ address }) => address === rekeyed.address,
        )
        const onRecord =
            record?.rekeyAddress === algo25.address ||
            Object.values(
                (record?.rekeyAddressByNetwork ?? {}) as Record<string, string>,
            ).includes(algo25.address)
        const inMaps =
            state.authorities?.[toScopeKey(scope)]?.[rekeyed.address] ===
                algo25.address ||
            state.unscopedAuthorities?.[rekeyed.address] === algo25.address
        expect(
            onRecord || inMaps,
            'the persisted payload lost the rekey authority',
        ).toBe(true)
    }

    // What the app does at launch: the store rehydrates from storage, then the
    // chain-state slice is built from the database and the store's authorities.
    const launch = async (db: Database) => {
        await useAccountsStore.persist.rehydrate()
        expectAuthorityDurable()
        await hydrateAccountChainStates({ db })
        expectAuthorityDurable()
    }

    const heldAccount = (address: string): WalletAccount => {
        const account = useAccountsStore
            .getState()
            .accounts.find(candidate => candidate.address === address)
        if (!account) throw new Error(`${address} is no longer held`)
        return account
    }

    const signAndSubmit = async (
        sender: ConformanceAccount,
        expectedSigner: ConformanceAccount,
        note: string,
    ): Promise<void> => {
        const accounts = useAccountsStore.getState().accounts
        const signer = resolveSigningAccount(
            heldAccount(sender.address),
            { type: 'local' },
            'transactions',
            accounts,
            LEGACY_CHAIN_ID,
        )
        expect(signer.address).toBe(expectedSigner.address)

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: sender.address,
                amount: microAlgo(0n),
                note,
                ...(expectedSigner.kind === 'quantum' && {
                    staticFee: microAlgo(
                        calculateMinTxnFee({
                            baseMinFee,
                            isPQSigner: true,
                            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
                        }),
                    ),
                }),
            })
        })
        // The migrated record signs, not the harness's own account model.
        const [signed] = await signTransactionsWithLocalKey(
            localKeySigningDeps(keyStore),
            [txn],
            [0],
            signer,
        )
        const bytes = encodeSignedTransaction(signed)
        expect(algosdk.decodeSignedTransaction(bytes).sgnr?.toString()).toBe(
            sender === expectedSigner ? undefined : expectedSigner.address,
        )
        await submitAndConfirm(bytes)
    }

    const expectAccountsBehave = async (phase: string): Promise<void> => {
        const accounts = useAccountsStore.getState().accounts
        expect(accounts.map(account => account.address)).toEqual([
            algo25.address,
            hd.address,
            quantum.address,
            rekeyed.address,
            fixtureAccounts.watch.address,
        ])
        expect(isWatchAccount(heldAccount(fixtureAccounts.watch.address))).toBe(
            true,
        )

        for (const account of [algo25, hd, quantum]) {
            await signAndSubmit(account, account, `${phase} ${account.kind}`)
        }
        await signAndSubmit(rekeyed, algo25, `${phase} rekeyed`)

        // The guard that stops removing an account another account signs through.
        const delegated = accountsChainAdapters
            .get(LEGACY_CHAIN_ID)
            .authority?.accountsDelegatedTo(algo25.address, accounts)
        expect(delegated?.map(account => account.address)).toEqual([
            rekeyed.address,
        ])

        const persisted = readPersisted()
        for (const record of persisted.accounts) {
            for (const field of LEGACY_RECORD_FIELDS) {
                expect(
                    record,
                    `${record.address} kept ${field}`,
                ).not.toHaveProperty(field)
            }
            // v4 renamed the Algorand-specific seed scheme.
            expect(
                (record.custody as { seed?: unknown }).seed,
                `${record.address} kept the algo25 seed scheme`,
            ).not.toBe('algo25')
        }
        expect(persisted.authorities?.[toScopeKey(scope)]).toEqual({
            [rekeyed.address]: algo25.address,
        })
    }

    describe.each(STORE_FIXTURES)('$name payload', fixture => {
        let db: Database
        let teardown: () => void

        beforeAll(async () => {
            ;({ db, teardown } = createTestDatabase())
            await runMigrations(db, migrations)
            useAccountsStore.getState().resetState()
            useAccountChainStateStore.getState().resetState()
            storage().setItem(STORE_KEY, fixture.payload(fixtureAccounts))
            await launch(db)
        })

        afterAll(() => teardown())

        it('keeps every account signing on the first launch', async () => {
            await expectAccountsBehave(`${fixture.name} first launch`)
        })

        // Nothing has synced, and the chain-state slice is memory-only: the
        // storage the store rehydrates from and the database are all a restart has.
        it.each(['first', 'second'])(
            'keeps every account signing after a %s cold start with no sync',
            async ordinal => {
                useAccountChainStateStore.getState().resetState()
                await launch(db)
                await expectAccountsBehave(`${fixture.name} ${ordinal} restart`)
            },
        )
    })
})
