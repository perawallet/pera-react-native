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

/*
 End-to-end quantum (post-quantum) transaction check against LocalNet.

 Everything except the node's own PQ support is asserted here and now:
 address derivation, funding, the signing preimage, and that our assembled
 bytes match algosdk's own PQ signer. Submission is then attempted, and a
 successful submission is followed by a bounded wait for confirmation — PASS
 means a Falcon-signed transaction actually landed in a block, not merely
 that algod admitted the bytes to its pool:

   confirmed                       -> PASS    (exit 0)
   rejected for an unknown `pqsig` -> PENDING (exit 0, loud)
   anything else (including a      -> FAIL    (exit 1)
     submit accepted but never
     confirmed within the bound)

 PASS needs two things together: the `algorand/algod:master` image, and a
 genesis whose consensus enables the scheme (AlgoKit's
 `algod_network_template.json` sets no `ConsensusProtocol`, so add
 `"ConsensusProtocol": "future"`). A stable or nightly algod, and every public
 network, reject `pqsig` with "no matching struct field found ... key pqsig"
 while accepting `sig`, so PENDING is the expected result there. Only the
 `sendRawTransaction` rejection reason gates PENDING vs FAIL, and only actual
 confirmation (not mere acceptance) gates PASS.

 Run with: pnpm localnet:quantum-check
 This is a dev tool, not a vitest test — it does not run in CI.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import {
    addressWithSignersFromRawPQSigner,
    encodeMsgpack,
    FALCON_1024_SCHEME,
    waitForConfirmation,
} from 'algosdk'
import { generateKey, signCompressed } from 'falcon-1024'
import { calculateMinTxnFee } from '../packages/blockchain/src/fees/feeCalculator'
import {
    assemblePQSignedTransaction,
    deriveQuantumAddress,
    pqSigningDigest,
} from '../packages/blockchain/src/pq/quantumAdapter'

// Mirrors `FALLBACK_PQ_MULTIPLIER` in
// `packages/blockchain/src/fees/useMinimumFeeConfig.ts` — that constant isn't
// exported (it backs a React hook wired to remote config), so this script,
// which has neither, keeps its own copy of the same default.
const PQ_FEE_MULTIPLIER = 3n

// Matches algod's msgpack decode error for a field it doesn't know, scoped to
// `pqsig` specifically. Any OTHER failure — bad signature, insufficient fee,
// overspend, network error — must NOT match this and must FAIL loudly. See
// the two-tier contract in the file header. Only ever tested against the
// *submit* rejection reason (see below) — it is never consulted for a
// confirmation-wait failure, so it cannot widen what counts as PENDING.
const PQSIG_UNSUPPORTED = /no matching struct field found.*pqsig/i

// Mirrors `DEFAULT_ROUNDS_TO_WAIT` in
// `packages/signing/src/pipeline/submission/submitAndAutoRefresh.ts` — that
// constant isn't exported, so this script keeps its own copy of the same
// default and calls algosdk's `waitForConfirmation` the same way that file
// does (client, txid, waitRounds).
const CONFIRMATION_WAIT_ROUNDS = 10

// A round-bounded wait can still hang in practice if the node stalls (its
// long-poll `statusAfterBlock` call has no hard client-side deadline), so a
// wall-clock ceiling on top of the round bound guarantees this script always
// terminates: a node that accepts a transaction but never confirms it must
// produce a FAIL, never a hang.
const CONFIRMATION_TIMEOUT_MS = 30_000

function fail(message: string): never {
    console.error(`FAIL: ${message}`)
    process.exit(1)
}

const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
): Promise<T> =>
    Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        }),
    ])

async function main(): Promise<void> {
    const algorand = AlgorandClient.defaultLocalNet()

    // Reachability check — fail fast with a clear message.
    try {
        await algorand.client.algod.status().do()
    } catch {
        fail('LocalNet is not reachable. Run `pnpm localnet` first.')
    }

    // --- Derivation --------------------------------------------------------
    const seed = new Uint8Array(48)
    crypto.getRandomValues(seed)
    const { publicKey, privateKey } = generateKey(seed)
    const address = deriveQuantumAddress(publicKey)
    console.log(`quantum address: ${address}`)

    // --- Funding -------------------------------------------------------------
    const dispenser = await algorand.account.localNetDispenser()
    await algorand.send.payment({
        sender: dispenser.addr,
        receiver: address,
        amount: (2_000_000).microAlgo(),
    })
    const info = await algorand.client.algod.accountInformation(address).do()
    if (info.amount <= 0n) {
        fail('funding the quantum address did not land')
    }
    console.log(`funded: ${info.amount} microAlgos`)

    // --- Build the transaction, fee-raised for a PQ signature ---------------
    const suggestedParams = await algorand.getSuggestedParams()
    const staticFee = calculateMinTxnFee({
        baseMinFee: BigInt(suggestedParams.minFee),
        isPQSigner: true,
        pqMultiplier: PQ_FEE_MULTIPLIER,
    })
    const txn = await algorand.createTransaction.payment({
        sender: address,
        receiver: dispenser.addr,
        amount: (1000).microAlgo(),
        staticFee: staticFee.microAlgo(),
    })

    // --- Sign and assemble, then check full byte-parity against algosdk's own
    // PQ signer. The SDK hands its raw signer `bytesToSign()` verbatim — the
    // same preimage `pqSigningDigest` returns — and this Falcon build is
    // deterministic, so the encodings must match exactly, signature included.
    // On-chain confirmation below independently proves the preimage. ----------
    const signature = signCompressed(privateKey, pqSigningDigest(txn))
    const ours = encodeMsgpack(
        assemblePQSignedTransaction({
            txn,
            signature: { schemeId: 'falcon1024', publicKey, signature },
        }),
    )

    const { txnSigner } = addressWithSignersFromRawPQSigner({
        pqScheme: FALCON_1024_SCHEME,
        pqPublicKey: publicKey,
        pqSigner: bytes => Promise.resolve(signCompressed(privateKey, bytes)),
    })
    const [reference] = await txnSigner([txn], [0])

    if (!Buffer.from(ours).equals(Buffer.from(reference))) {
        fail(
            "assembled PQ transaction differs byte-for-byte from algosdk's own PQ signer — scheme/salt/key/sgnr or the signed preimage is wrong",
        )
    }
    console.log(
        "assembled PQ transaction matches algosdk's PQ signer byte-for-byte",
    )

    // --- Submit: this is the only step allowed to land in PENDING -----------
    let txid: string
    try {
        const response = (await algorand.client.algod
            .sendRawTransaction(ours)
            .do()) as { txid?: string }
        const responseTxid = response.txid
        if (!responseTxid) {
            fail(
                'sendRawTransaction accepted the submission but returned no txid',
            )
        }
        txid = responseTxid
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (PQSIG_UNSUPPORTED.test(message)) {
            console.log(
                'PENDING: everything up to submission passed. This node does not ' +
                    'support the `pqsig` field yet, so broadcast cannot be verified. ' +
                    'Re-run against a pqsig-capable algod to convert this to PASS.',
            )
            process.exit(0)
        }
        fail(`submission failed for an unexpected reason: ${message}`)
    }
    console.log(`submitted: txid ${txid}, awaiting confirmation...`)

    // --- Confirm: bounded by both round count and wall-clock time, and NEVER
    // eligible for PENDING — an accepted-but-unconfirmed transaction is
    // always a FAIL, since that is precisely the "algod ate the bytes but
    // nothing actually landed on chain" outcome this fix closes off. -------
    try {
        const pending = await withTimeout(
            waitForConfirmation(
                algorand.client.algod,
                txid,
                CONFIRMATION_WAIT_ROUNDS,
            ),
            CONFIRMATION_TIMEOUT_MS,
            `not confirmed within ${CONFIRMATION_TIMEOUT_MS}ms wall-clock bound`,
        )
        console.log(
            `PASS: confirmed in round ${pending.confirmedRound}, txid ${txid}`,
        )
        process.exit(0)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        fail(`accepted by algod but never confirmed: ${message}`)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
