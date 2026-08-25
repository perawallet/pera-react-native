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
import algosdk, { waitForConfirmation } from 'algosdk'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
    encodeSignedTransactions,
    groupTransactions,
} from '@perawallet/wallet-core-blockchain/utils/transact'
import { Networks } from '@perawallet/wallet-core-config/models/network'
// `submitAndAutoRefresh.ts` also imports the full `@perawallet/wallet-core-blockchain`
// barrel (for real `toAlgodError` classification logic this suite exercises).
// That barrel IS aliased to `src` like every other import here — the barrel
// itself is not the problem. The problem is one level out: the barrel's own
// source has non-aliased dependencies (`wallet-core-remote-config`,
// `wallet-extension-platform`, `wallet-core-hardware-wallet`,
// `wallet-core-database`) that each resolve through their built `dist/` —
// see conformance/README.md for exactly which files pull in which package.
// Without those dists this import fails at collection time (an
// unresolvable-import crash, not a test failure) and takes every file in
// the run down with it.
import { submitAndAutoRefreshCore } from '@perawallet/wallet-core-signing/pipeline/submission/submitAndAutoRefresh'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { buildTxn, signWithKeystore } from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

const CONFIRMATION_ROUNDS = 10

/**
 * Exercises the real chokepoint every broadcast flow passes through
 * (`submitAndAutoRefreshCore`, `submitAndAutoRefresh.ts:97`), wired to a real
 * LocalNet algod rather than mocked collaborators — the shape the app's own
 * unit tests (`submitAndAutoRefresh.spec.ts`) cannot exercise since they stub
 * `algokit.client.algod`.
 */
describe('submission chokepoint conformance', () => {
    let keyStore: ConformanceKeyStore
    let sender: ConformanceAccount
    let receiverA: ConformanceAccount
    let receiverB: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        sender = await createAlgo25Account(keyStore)
        receiverA = await createAlgo25Account(keyStore)
        receiverB = await createAlgo25Account(keyStore)
        await fundAccount(sender.address, 5_000_000n)
        await fundAccount(receiverA.address, 500_000n)
        await fundAccount(receiverB.address, 500_000n)
    })

    it('submits a single payment and confirms it, dispatching onConfirmed', async () => {
        const algokit = getConformanceClient()
        const algod = algokit.client.algod

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(1000n),
            })
        })
        const signedBytes = await signWithKeystore(keyStore, sender, txn)
        const signedTxn = algosdk.decodeSignedTransaction(signedBytes)
        const expectedTxId = signedTxn.txn.txID()
        const onConfirmed = vi.fn()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation: (txId: string) =>
                waitForConfirmation(algod, txId, CONFIRMATION_ROUNDS).then(
                    () => undefined,
                ),
            verifyTxnLanded: (txId: string) =>
                waitForConfirmation(algod, txId, CONFIRMATION_ROUNDS).then(
                    () => undefined,
                ),
            walletAddresses: [sender.address],
            network: Networks.custom,
            onConfirmed,
            signedTxns: [signedTxn],
        })

        expect(txIds).toEqual([expectedTxId])

        // Confirmation and the onConfirmed dispatch run in a fire-and-forget
        // background task (see submitAndAutoRefresh.ts's backgroundConfirmAndRefresh);
        // the returned promise resolves before either happens.
        // vi.waitFor's own default timeout (1000ms) is unrelated to this
        // file's 120s vitest testTimeout — a slow LocalNet round would hit
        // vi.waitFor's short default first, so it is raised explicitly.
        await vi.waitFor(
            () =>
                expect(onConfirmed).toHaveBeenCalledWith(
                    [sender.address],
                    Networks.custom,
                ),
            { timeout: 30_000 },
        )

        const confirmed = await waitForConfirmation(
            algod,
            expectedTxId,
            CONFIRMATION_ROUNDS,
        )
        expect(confirmed.confirmedRound).toBeGreaterThan(0n)
    })

    it("submits a two-leg group; algod only echoes the first leg's id, but both legs confirm", async () => {
        const algokit = getConformanceClient()
        const algod = algokit.client.algod

        const legA = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverA.address,
                amount: microAlgo(3000n),
            })
        })
        const legB = await buildTxn(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiverB.address,
                amount: microAlgo(4000n),
            })
        })
        const [g0, g1] = groupTransactions([legA, legB])
        const signedBytesA = await signWithKeystore(keyStore, sender, g0)
        const signedBytesB = await signWithKeystore(keyStore, sender, g1)
        const signedA = algosdk.decodeSignedTransaction(signedBytesA)
        const signedB = algosdk.decodeSignedTransaction(signedBytesB)
        const secondLegTxId = signedB.txn.txID()

        const { txIds } = await submitAndAutoRefreshCore({
            algokit,
            encodeSignedTransactions,
            waitForConfirmation: (txId: string) =>
                waitForConfirmation(algod, txId, CONFIRMATION_ROUNDS).then(
                    () => undefined,
                ),
            verifyTxnLanded: (txId: string) =>
                waitForConfirmation(algod, txId, CONFIRMATION_ROUNDS).then(
                    () => undefined,
                ),
            walletAddresses: [sender.address],
            network: Networks.custom,
            onConfirmed: vi.fn(),
            signedTxns: [signedA, signedB],
        })

        // algod's sendRawTransaction response carries only one txid for a
        // submitted group (confirmed empirically against LocalNet), so the
        // chokepoint's returned array is deliberately length-1 here — the
        // group itself, not this return value, is what confirms atomically.
        expect(txIds).toEqual([signedA.txn.txID()])

        const confirmedSecondLeg = await waitForConfirmation(
            algod,
            secondLegTxId,
            CONFIRMATION_ROUNDS,
        )
        expect(confirmedSecondLeg.confirmedRound).toBeGreaterThan(0n)
    })
})
