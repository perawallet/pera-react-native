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
 End-to-end quantum (post-quantum) transaction check against LocalNet
 (PERA-4653, Task 8).

 Everything except the node's own PQ support is asserted here and now:
 address derivation, funding, the signing preimage, and that our assembled
 bytes match algosdk's own PQ signer. Submission is then attempted:

   confirmed                       -> PASS    (exit 0)
   rejected for an unknown `pqsig` -> PENDING (exit 0, loud)
   anything else                   -> FAIL    (exit 1)

 As of 2026-07-28 no public algod accepts `pqsig` — 4.7.4-stable (this
 repo's LocalNet) and rel/nightly build 2680 both reject it with the same
 "no matching struct field found ... key pqsig" error, while accepting `sig`
 — so PENDING is the expected result today. This script becomes a true
 end-to-end test, unchanged, the moment a pqsig-capable node ships: only the
 final `sendRawTransaction` call's outcome decides PASS vs PENDING, and both
 exit 0 so this never blocks CI.

 Run with: pnpm localnet:quantum-check
 This is a dev tool, not a vitest test — it does not run in CI.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import {
    addressWithSignersFromRawPQSigner,
    encodeMsgpack,
    FALCON_1024_SCHEME,
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
// the two-tier contract in the file header.
const PQSIG_UNSUPPORTED = /no matching struct field found.*pqsig/i

const fail = (message: string): never => {
    console.error(`FAIL: ${message}`)
    process.exit(1)
}

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
        amount: (1_000).microAlgo(),
        staticFee: staticFee.microAlgo(),
    })

    // --- Sign and assemble, then prove it matches algosdk's own PQ signer ---
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

    if (Buffer.compare(Buffer.from(ours), Buffer.from(reference)) !== 0) {
        fail(
            "assembled bytes differ from algosdk's own PQ signer — the signing preimage is wrong",
        )
    }
    console.log("assembled bytes match algosdk's PQ signer")

    // --- Submit: this is the only step allowed to land in PENDING -----------
    try {
        const { txid } = (await algorand.client.algod
            .sendRawTransaction(ours)
            .do()) as { txid?: string }
        console.log(`PASS: submitted and accepted, txid ${txid}`)
        process.exit(0)
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
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
