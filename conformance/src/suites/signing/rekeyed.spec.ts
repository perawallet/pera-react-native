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
import { beforeAll, describe, expect, it } from 'vitest'

import { buildGroupSignerTypeMap } from '@perawallet/wallet-core-signing/machine/actions'
import { resolveSigningAccount } from '@perawallet/wallet-core-signing/machine/utils/resolveSigningAccount'

import {
    createAlgo25Account,
    fundAccount,
    type ConformanceAccount,
} from '../../harness/accounts'
import { algokeySign } from '../../harness/algokey'
import type { TxnIntent } from '../../harness/assert/intent'
import { expectConformant } from '../../harness/assert/roundTrip'
import {
    buildTxn,
    signWithKeystore,
    submitAndConfirm,
} from '../../harness/build'
import { authAddrOf, balanceOf } from '../../harness/client'
import {
    createConformanceKeyStore,
    type ConformanceKeyStore,
} from '../../harness/keystore'

/**
 * Full construction-level rekey mechanics (rekey-in, rekey-out, auth-addr
 * assertions) already live in
 * `suites/construction/rekey.spec.ts`. This file is narrower: given an
 * already-rekeyed account, does the app's Ed25519 signing path (real
 * `keyStore.sign`, real Falcon/Ed25519 shims) produce bytes byte-identical to
 * a real signer, and does a real node accept the `sgnr`-carrying envelope and
 * reject the pre-rekey key?
 *
 * The `sgnr` field is written by the app's own signer — the harness signs
 * through `signTransactionsWithLocalKey`, the same pure pipeline function
 * `useLocalKeyTransactionSigner` delegates to — so a regression in the app's
 * rekey-envelope rule fails here rather than passing against a harness copy
 * of it. The account-side half of the rule (which key to reach for) is
 * asserted separately below against `resolveSigningAccount` and
 * `buildGroupSignerTypeMap`, the app's own dispatch.
 */
describe('rekeyed signing conformance', () => {
    let keyStore: ConformanceKeyStore
    let source: ConformanceAccount
    let newAuth: ConformanceAccount
    let receiver: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        source = await createAlgo25Account(keyStore)
        newAuth = await createAlgo25Account(keyStore)
        receiver = await createAlgo25Account(keyStore)
        await fundAccount(source.address, 5_000_000n)
        // Below the 100_000 microAlgo minimum balance, a brand-new account
        // cannot hold the small spend amounts sent to it below.
        await fundAccount(receiver.address, 500_000n)

        const rekeyTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: source.address,
                amount: microAlgo(0n),
                rekeyTo: newAuth.address,
            })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, source, rekeyTxn),
        )
        // Both `it` blocks below rely on this having actually landed on-chain —
        // asserted here, concretely, so a partial `-t` run that only selects one
        // of them fails loudly on a broken rekey rather than passing vacuously.
        if ((await authAddrOf(source.address)) !== newAuth.address) {
            throw new Error(
                `setup failed: source auth-addr is not newAuth after rekey`,
            )
        }
    })

    it("signs a spend from source with newAuth's key: sgnr is newAuth, matches algokey byte-for-byte, and the node accepts it", async () => {
        const senderBalanceBefore = await balanceOf(source.address)
        const amount = 1000n

        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                amount: microAlgo(amount),
            })
        })

        const keystoreSignedBytes = await signWithKeystore(
            keyStore,
            newAuth,
            txn,
        )
        const decoded = algosdk.decodeSignedTransaction(keystoreSignedBytes)
        expect(decoded.sgnr?.toString()).toBe(newAuth.address)

        // algokey's own `sign` compares the mnemonic's derived address against
        // the transaction's sender and populates `sgnr` itself when they differ
        // — no separate "rekeyed sign" CLI command is needed.
        const oracleSignedBytes = await algokeySign({
            mnemonic: newAuth.mnemonic,
            unsignedTxn: algosdk.encodeUnsignedTransaction(txn),
        })

        // Byte-parity: catches a wrong preimage, a wrong signature, or a wrong
        // `sgnr` offline, without ever touching the node.
        expect(keystoreSignedBytes).toEqual(oracleSignedBytes)

        const { txId } = await submitAndConfirm(keystoreSignedBytes)

        const intent: TxnIntent = {
            type: 'pay',
            sender: source.address,
            receiver: receiver.address,
            amount,
            fee: txn.fee,
        }

        // Node acceptance: catches anything byte-parity can't, end-to-end —
        // in particular that algod actually resolves `sgnr` against the
        // account's on-chain auth-addr rather than trusting the envelope.
        await expectConformant({
            intent,
            signedBytes: keystoreSignedBytes,
            txId,
            senderBalanceBefore,
        })
    })

    it("rejects a spend signed by source's own key once rekeyed", async () => {
        const txn = await buildTxn(composer => {
            composer.addPayment({
                sender: source.address,
                receiver: receiver.address,
                // A different amount from the earlier spend in this file: two
                // otherwise-identical transactions built in the same LocalNet dev
                // round would share firstValid/lastValid and collide on txID.
                // Harmless today only because dev mode advances a round per
                // submission; this suite runs in CI, where that timing isn't
                // guaranteed.
                amount: microAlgo(2000n),
            })
        })
        // source's own key is well-formed and produces a validly-signed
        // envelope; only a real node — checking the envelope's signer against
        // the account's on-chain auth-addr — can reject it. A mock signer would
        // happily accept whatever key it's handed.
        const signedBytes = await signWithKeystore(keyStore, source, txn)

        // algod's own rejection names the auth-addr it expects and the key
        // that actually signed, proving the account really is rekeyed on-chain
        // (not merely assumed) and that algod, not the app, is the one
        // enforcing it.
        await expect(submitAndConfirm(signedBytes)).rejects.toThrow(
            new RegExp(
                `should have been authorized by ${newAuth.address} but was actually authorized by ${source.address}`,
            ),
        )
    })
})

/**
 * The envelope half of rekeyed signing is proven above. This is the account
 * half: given a rekeyed account, does the app reach for the auth account's
 * key, and does it route that group to the local-key signer? Both decisions
 * are made offline by pure app code, but only a real node can confirm the
 * account they are made about is genuinely rekeyed — which the `beforeAll`
 * above establishes on chain.
 */
describe('rekeyed signer resolution conformance', () => {
    let keyStore: ConformanceKeyStore
    let rekeyed: ConformanceAccount
    let auth: ConformanceAccount

    beforeAll(async () => {
        keyStore = await createConformanceKeyStore()
        rekeyed = await createAlgo25Account(keyStore)
        auth = await createAlgo25Account(keyStore)
        await fundAccount(rekeyed.address, 2_000_000n)

        const rekeyTxn = await buildTxn(composer => {
            composer.addPayment({
                sender: rekeyed.address,
                receiver: rekeyed.address,
                amount: microAlgo(0n),
                rekeyTo: auth.address,
            })
        })
        await submitAndConfirm(
            await signWithKeystore(keyStore, rekeyed, rekeyTxn),
        )
    })

    it("resolves a transaction's signer to the auth account the chain reports", async () => {
        // The chain is the source of truth for the rekey; the account model
        // is populated from it rather than from the test's own assumption.
        const onChainAuth = await authAddrOf(rekeyed.address)
        expect(onChainAuth).toBe(auth.address)

        const account = {
            ...rekeyed.walletAccount,
            rekeyAddress: onChainAuth,
        }
        const allAccounts = [account, auth.walletAccount]

        const resolved = resolveSigningAccount(
            account,
            { type: 'walletConnect' } as never,
            'transactions',
            allAccounts,
        )

        expect(resolved.address).toBe(auth.address)
        expect(resolved.keyPairId).toBe(auth.walletAccount.keyPairId)
    })

    it('does NOT follow the rekey hop for off-chain data, which has no auth-addr lookup', async () => {
        const account = {
            ...rekeyed.walletAccount,
            rekeyAddress: await authAddrOf(rekeyed.address),
        }
        const allAccounts = [account, auth.walletAccount]

        // A dApp verifies an off-chain signature against the requested
        // account's own pubkey, so following the hop here would produce a
        // signature the dApp rejects — with no node to catch it.
        expect(
            resolveSigningAccount(
                account,
                { type: 'walletConnect' } as never,
                'arbitrary-data',
                allAccounts,
            ).address,
        ).toBe(rekeyed.address)
    })

    it('routes a rekeyed account to the local-key signer, since its auth account holds local keys', async () => {
        const account = {
            ...rekeyed.walletAccount,
            rekeyAddress: await authAddrOf(rekeyed.address),
        }
        const allAccounts = [account, auth.walletAccount]

        const map = buildGroupSignerTypeMap(
            [
                {
                    signerAddress: rekeyed.address,
                    source: { type: 'walletConnect' },
                    data: { type: 'transactions' },
                } as never,
            ],
            allAccounts,
        )

        expect(map.get(rekeyed.address)).toBe('localKey')
    })
})
