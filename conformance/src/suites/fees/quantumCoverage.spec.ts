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

// A dApp that simulates with this wallet's empty signatures already prices the
// PQ premium in; one that doesn't prices for ed25519. Against a pqsig-capable
// node, these pin that the fee planner adds the surcharge to the second and
// never the first, with and without inner transactions.

import { AlgorandClient, microAlgo } from '@algorandfoundation/algokit-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { FALLBACK_PQ_MULTIPLIER } from '@perawallet/wallet-core-chain-algorand/blockchain/constants'
import { calculateMinTxnFee } from '@perawallet/wallet-core-chain-algorand/blockchain/fees/feeCalculator'
import { assignFeeToGroup } from '@perawallet/wallet-core-chain-algorand/signing/assignMinimumFeesToGroup'
import { findFundedIndices } from '@perawallet/wallet-core-chain-algorand/signing/feeCoverage'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { algorandAccountsAdapter } from '@perawallet/wallet-core-chain-algorand/accounts/adapter'
import {
    scopeForLegacyNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { config, Networks } from '@perawallet/wallet-core-config'

import {
    createAlgo25Account,
    createQuantumAccount,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import {
    buildGroup,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { getConformanceClient } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'
import { localNetScope } from '../../harness/scope'

const INNER_TXN_COUNT = 3

// algod words a short outer fee "less than", and an inner transaction's
// shortfall "group fee ... too small".
const FEE_TOO_LOW = /less than|too small/

const innerPayment = `itxn_begin
int pay
itxn_field TypeEnum
txn Sender
itxn_field Receiver
int 0
itxn_field Amount
int 0
itxn_field Fee
itxn_submit`

// Each call issues three zero-fee inner payments, so the outer fee must pool
// for them.
const APPROVAL = `#pragma version 8
txn ApplicationID
bz done
${Array.from({ length: INNER_TXN_COUNT }, () => innerPayment).join('\n')}
done:
int 1
return`

const CLEAR = `#pragma version 8
int 1
return`

describe('quantum fee coverage conformance', () => {
    let keyStore: ConformanceKeyStore
    let pq: ConformanceAccount
    let standard: ConformanceAccount
    let rekeyed: ConformanceAccount
    let receiver: ConformanceAccount
    let appId: bigint
    let baseMinFee: bigint
    let pqMinFee: bigint
    let surcharge: bigint
    let noteSeq = 0

    // Distinct notes keep otherwise identical calls from colliding as duplicates.
    const note = () => new TextEncoder().encode(`coverage-${noteSeq++}`)

    const assignAsDapp = (
        transactions: PeraTransaction[],
        accounts: WalletAccount[],
    ) =>
        assignFeeToGroup(
            { transactions, isExternallyPriced: true },
            {
                accounts,
                fetchSuggestedMinFee: async () => baseMinFee,
                configMinTxnFee: baseMinFee,
                pqMultiplier: FALLBACK_PQ_MULTIPLIER,
                findFundedIndices: params =>
                    findFundedIndices({
                        ...params,
                        accounts,
                        network: Networks.custom,
                    }),
            },
        )

    const appCall = (sender: ConformanceAccount, fee: bigint) =>
        buildGroup(composer => {
            composer.addAppCall({
                sender: sender.address,
                appId,
                staticFee: microAlgo(fee),
                note: note(),
            })
        })

    const payment = (sender: ConformanceAccount, fee: bigint) =>
        buildGroup(composer => {
            composer.addPayment({
                sender: sender.address,
                receiver: receiver.address,
                amount: microAlgo(250_000n),
                staticFee: microAlgo(fee),
                note: note(),
            })
        })

    const submit = async (
        signers: ConformanceAccount[],
        transactions: PeraTransaction[],
    ) =>
        submitAndConfirm(
            await Promise.all(
                transactions.map((txn, index) =>
                    signWithKeystore(keyStore, signers[index], txn),
                ),
            ),
        )

    beforeAll(async () => {
        await localNetScope()
        keyStore = await createConformanceKeyStore()
        pq = await createQuantumAccount(keyStore)
        standard = await createAlgo25Account(keyStore)
        rekeyed = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await Promise.all(
            [pq, standard, rekeyed].map(({ address }) =>
                fundAccount(address, 10_000_000n),
            ),
        )

        const { minFee } = await getConformanceClient()
            .client.algod.getTransactionParams()
            .do()
        baseMinFee = BigInt(minFee)
        pqMinFee = calculateMinTxnFee({
            baseMinFee,
            isPQSigner: true,
            pqMultiplier: FALLBACK_PQ_MULTIPLIER,
        })
        surcharge = pqMinFee - baseMinFee

        const localNet = AlgorandClient.defaultLocalNet()
        const dispenser = await localNet.account.localNetDispenser()
        const created = await localNet.send.appCreate({
            sender: dispenser.addr,
            approvalProgram: APPROVAL,
            clearStateProgram: CLEAR,
        })
        appId = BigInt(created.appId)
        await fundAccount(created.appAddress.toString(), 1_000_000n)

        const [rekey] = await buildGroup(composer => {
            composer.addPayment({
                sender: rekeyed.address,
                receiver: rekeyed.address,
                amount: microAlgo(0n),
                rekeyTo: pq.address,
            })
        })
        await submit([rekeyed], [rekey])
    })

    it('never checks or raises a standard account', async () => {
        const txns = await payment(standard, baseMinFee)

        const { transactions, adjustments } = await assignAsDapp(txns, [
            standard.walletAccount,
        ])

        expect(adjustments).toEqual([])
        expect(transactions).toBe(txns)
        await expect(submit([standard], transactions)).resolves.toBeDefined()
    })

    describe('without inner transactions', () => {
        it('leaves a PQ-priced fee alone, and the chain accepts it', async () => {
            const txns = await payment(pq, pqMinFee)

            const { transactions, adjustments } = await assignAsDapp(txns, [
                pq.walletAccount,
            ])

            expect(adjustments).toEqual([])
            await expect(submit([pq], transactions)).resolves.toBeDefined()
        })

        it('raises an ed25519-priced fee the chain would reject, to one it accepts', async () => {
            const txns = await payment(pq, baseMinFee)

            const { transactions, adjustments } = await assignAsDapp(txns, [
                pq.walletAccount,
            ])

            expect(transactions[0].fee).toBe(pqMinFee)
            expect(adjustments).toHaveLength(1)
            await expect(submit([pq], txns)).rejects.toThrow(FEE_TOO_LOW)
            await expect(submit([pq], transactions)).resolves.toBeDefined()
        })

        it('leaves a PQ-priced fee alone for an account rekeyed to a PQ key', async () => {
            const account = rekeyed.walletAccount
            // What the account syncer records once it reads the chain's `auth-addr`.
            useAccountChainStateStore.getState().setAccountChainState(
                scopeForLegacyNetwork(config.defaultNetwork),
                account.address,
                algorandAccountsAdapter.toChainState({
                    authorityAddress: pq.address,
                }),
            )
            const txns = await payment(rekeyed, pqMinFee)

            const { transactions, adjustments } = await assignAsDapp(txns, [
                account,
                pq.walletAccount,
            ])

            expect(adjustments).toEqual([])
            // Signed by the authority, so the envelope carries `sgnr`.
            await expect(submit([pq], transactions)).resolves.toBeDefined()
        })
    })

    describe(`with ${INNER_TXN_COUNT} inner transactions`, () => {
        const innerFees = () => baseMinFee * BigInt(INNER_TXN_COUNT)

        it('leaves a fee priced for the PQ signature and the inner fees alone', async () => {
            const txns = await appCall(pq, pqMinFee + innerFees())

            const { transactions, adjustments } = await assignAsDapp(txns, [
                pq.walletAccount,
            ])

            expect(adjustments).toEqual([])
            await expect(submit([pq], transactions)).resolves.toBeDefined()
        })

        it('adds the surcharge once to a fee priced for an ed25519 signature', async () => {
            const ed25519Priced = baseMinFee + innerFees()
            const txns = await appCall(pq, ed25519Priced)

            const { transactions } = await assignAsDapp(txns, [
                pq.walletAccount,
            ])

            expect(transactions[0].fee).toBe(ed25519Priced + surcharge)
            await expect(submit([pq], txns)).rejects.toThrow(FEE_TOO_LOW)
            await expect(submit([pq], transactions)).resolves.toBeDefined()
        })

        // The documented ceiling: a group that can't pay for its inner
        // transactions even as ed25519 is the dApp's to price.
        it('still fails a group underfunded for its inner transactions', async () => {
            const txns = await appCall(pq, baseMinFee)

            const { transactions } = await assignAsDapp(txns, [
                pq.walletAccount,
            ])

            expect(transactions[0].fee).toBe(pqMinFee)
            await expect(submit([pq], transactions)).rejects.toThrow(
                FEE_TOO_LOW,
            )
        })
    })

    describe('with a zero-fee sibling in the group', () => {
        const pooled = (pqLegFee: bigint) =>
            buildGroup(composer => {
                composer.addPayment({
                    sender: pq.address,
                    receiver: receiver.address,
                    amount: microAlgo(250_000n),
                    staticFee: microAlgo(pqLegFee),
                    note: note(),
                })
                composer.addPayment({
                    sender: standard.address,
                    receiver: receiver.address,
                    amount: microAlgo(250_000n),
                    staticFee: microAlgo(0n),
                    note: note(),
                })
            })

        it('leaves a PQ leg alone that covers itself and its sibling', async () => {
            const txns = await pooled(pqMinFee + baseMinFee)

            const { transactions, adjustments } = await assignAsDapp(txns, [
                pq.walletAccount,
                standard.walletAccount,
            ])

            expect(adjustments).toEqual([])
            await expect(
                submit([pq, standard], transactions),
            ).resolves.toBeDefined()
        })

        it('raises a PQ leg priced for ed25519, and the regrouped pair lands', async () => {
            const txns = await pooled(baseMinFee * 2n)

            const { transactions, adjustments } = await assignAsDapp(txns, [
                pq.walletAccount,
                standard.walletAccount,
            ])

            expect(adjustments.map(a => a.index)).toEqual([0])
            expect(transactions[0].fee).toBe(baseMinFee * 2n + surcharge)
            await expect(
                submit([pq, standard], transactions),
            ).resolves.toBeDefined()
        })
    })
})
