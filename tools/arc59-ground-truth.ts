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
 Read-only dev tool — NEVER signs or submits. Does not run in CI.
 Run with: pnpm exec tsx tools/arc59-ground-truth.ts

 Finds real pending ARC59 mainnet state, builds each flow's group exactly as the
 app's hooks do, populates resources through the same helper, then
 strict-simulates (empty signatures, no unnamed resources) to prove the recorded
 references are submission-valid. The populated per-txn resources are written to
 a checked-in fixture that the explicit-ref builders assert they reproduce.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import algosdk from 'algosdk'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ARC59Client } from '../packages/asa-inbox/src/clients'
import { buildPopulatedGroup } from '../packages/asa-inbox/src/utils'
import {
    BASE_CLAIM_TX_COUNT,
    BASE_REJECT_TX_COUNT,
    CLAIM_ALGO_TX_COUNT,
} from '../packages/asa-inbox/src/constants'

const ALGOD_URL = 'https://mainnet-api.algonode.cloud'
const INDEXER_URL = 'https://mainnet-idx.algonode.cloud'
// Mirrors packages/config/src/main.ts `config.arc59.mainnet` — hardcoded
// here (rather than importing @perawallet/wallet-core-config) because this
// tool runs standalone via tsx from the repo root, outside the pnpm
// workspace's package-to-package module resolution.
const APP_ID = 2_449_590_623n
const ROUTER_ADDRESS =
    'EZRVNZFJGOUZC67FUMEC7ZMVP232TPICFTQCVZ6EQEIRRT3TIHSKZULRNI'
const ZERO_ADDR = algosdk.encodeAddress(new Uint8Array(32))

const FIXTURE_PATH = fileURLToPath(
    new URL(
        '../packages/asa-inbox/src/hooks/__tests__/fixtures/arc59-resource-refs.json',
        import.meta.url,
    ),
)

// Stand-in for the arc59-send-summary endpoint, which needs a backend API key
// this tool doesn't have. Matches the baseline in the repo's own unit tests: an
// existing inbox needs an inner opt-in plus an inner axfer, a 0.1 ALGO MBR bump
// for the new holding row, and no extra funding.
//
// Chosen to be SUFFICIENT, not exact — enough for the strict simulate to prove
// the group is submittable, not a claim about the backend's real numbers.
const SYNTHESIZED_SEND_SUMMARY_BASE = {
    minimum_balance_requirement: 100_000,
    inner_tx_count: 2,
    algo_fund_amount: 0,
    total_protocol_and_mbr_fee: 100_000,
    warning_message: null,
} as const

type TxnRefs = {
    type: string
    accounts: string[]
    foreignAssets: string[]
    foreignApps: string[]
    boxes: string[]
}

type FlowFixture = {
    receiver?: string
    inbox?: string
    sender?: string
    assetId?: string
    notes?: string
    txns: TxnRefs[]
}

type Fixture = Record<string, FlowFixture>

function extractRefs(txns: algosdk.Transaction[]): TxnRefs[] {
    return txns.map(t => {
        const ac = t.applicationCall
        return {
            type: t.type,
            accounts: (ac?.accounts ?? []).map(a => a.toString()),
            foreignAssets: (ac?.foreignAssets ?? []).map(id => id.toString()),
            foreignApps: (ac?.foreignApps ?? []).map(id => id.toString()),
            boxes: (ac?.boxes ?? []).map(b =>
                Buffer.from(b.name).toString('hex'),
            ),
        }
    })
}

function printRefs(flow: string, txns: algosdk.Transaction[]): void {
    console.log(`\n--- ${flow} ---`)
    extractRefs(txns).forEach((r, i) => {
        console.log(
            `  txn[${i}] type=${r.type} accounts=${JSON.stringify(r.accounts)} foreignAssets=${JSON.stringify(r.foreignAssets)} foreignApps=${JSON.stringify(r.foreignApps)} boxes=${JSON.stringify(r.boxes)}`,
        )
    })
}

async function strictSimulate(
    algod: algosdk.Algodv2,
    txns: algosdk.Transaction[],
): Promise<{ pass: boolean; message?: string }> {
    const atc = new algosdk.AtomicTransactionComposer()
    for (const original of txns) {
        // Clone so we don't mutate the txns we're about to record refs from;
        // strip the group id so the ATC re-groups from scratch, mirroring
        // what the app's own submission path does after `buildPopulatedGroup`.
        const clone = algosdk.decodeUnsignedTransaction(original.toByte())
        clone.group = undefined
        atc.addTransaction({
            txn: clone,
            signer: algosdk.makeEmptyTransactionSigner(),
        })
    }
    try {
        const res = await atc.simulate(
            algod,
            new algosdk.modelsv2.SimulateRequest({
                txnGroups: [],
                allowEmptySignatures: true,
                fixSigners: true,
            }),
        )
        const failure = res.simulateResponse.txnGroups[0]?.failureMessage
        return failure ? { pass: false, message: failure } : { pass: true }
    } catch (e) {
        const err = e as Error
        return { pass: false, message: `[${err.name}] ${err.message}` }
    }
}

type PendingInbox = {
    receiver: string
    inbox: string
    assetId: bigint
    optedIn: boolean
    inboxSpareAlgos: bigint
}

/**
 * Scans router boxes for pending inboxes, classifying each as a "claim"
 * candidate (no spare ALGO) or "claimWithAlgo" (spare above its own MBR).
 * Returns as soon as both are found, or after `maxPages`.
 */
async function findPendingInboxes(
    algod: algosdk.Algodv2,
    indexer: algosdk.Indexer,
    maxPages: number,
    pageSize: number,
): Promise<{ claim?: PendingInbox; claimWithAlgo?: PendingInbox }> {
    let claim: PendingInbox | undefined
    let claimWithAlgo: PendingInbox | undefined
    let nextToken: string | undefined

    for (let page = 0; page < maxPages && (!claim || !claimWithAlgo); page++) {
        let req = indexer
            .searchForApplicationBoxes(Number(APP_ID))
            .limit(pageSize)
        if (nextToken) req = req.nextToken(nextToken)
        const boxesRes = await req.do()
        console.log(
            `page ${page}: ${boxesRes.boxes.length} boxes (nextToken=${Boolean(boxesRes.nextToken)})`,
        )

        for (const box of boxesRes.boxes) {
            if (claim && claimWithAlgo) break
            if (box.name.length !== 32) continue
            const receiver = algosdk.encodeAddress(box.name)
            if (receiver === ZERO_ADDR) continue
            try {
                const boxVal = await algod
                    .getApplicationBoxByName(Number(APP_ID), box.name)
                    .do()
                if (boxVal.value.length !== 32) continue
                const inbox = algosdk.encodeAddress(boxVal.value)
                const inboxInfo = await algod.accountInformation(inbox).do()
                const held = (inboxInfo.assets ?? []).filter(a => a.amount > 0n)
                if (held.length === 0) continue
                const assetId = BigInt(held[0].assetId)

                const rcvInfo = await algod.accountInformation(receiver).do()
                const spendable = rcvInfo.amount - rcvInfo.minBalance
                if (spendable < 10_000n) continue
                const optedIn = (rcvInfo.assets ?? []).some(
                    a => BigInt(a.assetId) === assetId,
                )
                const inboxSpareAlgos = inboxInfo.amount - inboxInfo.minBalance

                const candidate: PendingInbox = {
                    receiver,
                    inbox,
                    assetId,
                    optedIn,
                    inboxSpareAlgos,
                }

                if (!claim && !optedIn && inboxSpareAlgos === 0n) {
                    claim = candidate
                    console.log(
                        `  found "claim" candidate: receiver=${receiver} inbox=${inbox} asset=${assetId}`,
                    )
                }
                if (!claimWithAlgo && inboxSpareAlgos > 0n) {
                    claimWithAlgo = candidate
                    console.log(
                        `  found "claimWithAlgo" candidate: receiver=${receiver} inbox=${inbox} asset=${assetId} spareAlgos=${inboxSpareAlgos}`,
                    )
                }
            } catch {
                continue
            }
        }

        if (!boxesRes.nextToken) break
        nextToken = boxesRes.nextToken
    }

    return { claim, claimWithAlgo }
}

/** Builds a claim (or claim+algo) group exactly as useArc59ClaimTransaction.buildClaimAssetTxs does. */
async function buildClaimGroup(
    algokit: AlgorandClient,
    sender: string,
    assetId: bigint,
    shouldClaimAlgo: boolean,
    optedIn: boolean,
): Promise<algosdk.Transaction[]> {
    const suggestedParams = await algokit.getSuggestedParams()
    const appClient = new ARC59Client({
        appId: APP_ID,
        algorand: algokit,
        defaultSender: sender,
    })

    const minFee = BigInt(suggestedParams.minFee)
    let claimFee = BigInt(BASE_CLAIM_TX_COUNT) * minFee
    if (shouldClaimAlgo) claimFee += BigInt(CLAIM_ALGO_TX_COUNT) * minFee
    if (!optedIn) claimFee += minFee

    const composer = algokit.newGroup()
    if (shouldClaimAlgo) {
        composer.addAppCallMethodCall(
            await appClient.params.arc59_claimAlgo({
                args: [],
                staticFee: 0n.microAlgo(),
            }),
        )
    }
    if (!optedIn) {
        composer.addAssetOptIn({
            sender,
            assetId,
            staticFee: 0n.microAlgo(),
        })
    }
    composer.addAppCallMethodCall(
        await appClient.params.arc59_claim({
            args: [assetId],
            staticFee: claimFee.microAlgo(),
        }),
    )

    return buildPopulatedGroup(composer, algokit)
}

/** Builds a reject group exactly as useArc59ClaimTransaction.buildRejectAssetTxs does. */
async function buildRejectGroup(
    algokit: AlgorandClient,
    sender: string,
    assetId: bigint,
    shouldClaimAlgo: boolean,
): Promise<algosdk.Transaction[]> {
    const suggestedParams = await algokit.getSuggestedParams()
    const appClient = new ARC59Client({
        appId: APP_ID,
        algorand: algokit,
        defaultSender: sender,
    })

    const minFee = BigInt(suggestedParams.minFee)
    let rejectFee = BigInt(BASE_REJECT_TX_COUNT) * minFee
    if (shouldClaimAlgo) rejectFee += BigInt(CLAIM_ALGO_TX_COUNT) * minFee

    const composer = algokit.newGroup()
    if (shouldClaimAlgo) {
        composer.addAppCallMethodCall(
            await appClient.params.arc59_claimAlgo({
                args: [],
                staticFee: 0n.microAlgo(),
            }),
        )
    }
    composer.addAppCallMethodCall(
        await appClient.params.arc59_reject({
            args: [assetId],
            staticFee: rejectFee.microAlgo(),
        }),
    )

    return buildPopulatedGroup(composer, algokit)
}

type SendSummary = {
    is_arc59_opted_in: boolean
    minimum_balance_requirement: number
    inner_tx_count: number
    algo_fund_amount: number
}

/** Builds a send-via-inbox group exactly as useArc59SendTransaction.buildSendViaInboxTxs does. */
async function buildSendGroup(
    algokit: AlgorandClient,
    sender: string,
    receiver: string,
    assetId: bigint,
    amount: bigint,
    summary: SendSummary,
): Promise<algosdk.Transaction[]> {
    const suggestedParams = await algokit.getSuggestedParams()
    const minFee = BigInt(suggestedParams.minFee)
    const appClient = new ARC59Client({
        appId: APP_ID,
        algorand: algokit,
        defaultSender: sender,
    })

    const composer = algokit.newGroup()

    const totalPaymentAmount =
        BigInt(summary.algo_fund_amount) +
        BigInt(summary.minimum_balance_requirement)

    if (totalPaymentAmount > 0n) {
        composer.addPayment({
            sender,
            receiver: ROUTER_ADDRESS,
            amount: totalPaymentAmount.microAlgo(),
        })
    }

    if (!summary.is_arc59_opted_in) {
        composer.addAppCallMethodCall(
            await appClient.params.arc59_optRouterIn({
                args: [assetId],
                extraFee: minFee.microAlgo(),
            }),
        )
    }

    composer.addAppCallMethodCall(
        await appClient.params.arc59_sendAsset({
            args: [
                await algokit.createTransaction.assetTransfer({
                    sender,
                    receiver: ROUTER_ADDRESS,
                    amount,
                    assetId,
                }),
                receiver,
                0,
            ],
            extraFee: (minFee * BigInt(summary.inner_tx_count)).microAlgo(),
        }),
    )

    return buildPopulatedGroup(composer, algokit)
}

/** Finds a real indexer-reported holder of `assetId` (excluding `exclude`) with spendable ALGO for fees + payment. */
async function findAssetHolder(
    algod: algosdk.Algodv2,
    indexer: algosdk.Indexer,
    assetId: bigint,
    exclude: Set<string>,
    minSpendableAlgos: bigint,
    minAssetBalance: bigint,
): Promise<{ address: string; assetBalance: bigint } | null> {
    const res = await indexer
        .lookupAssetBalances(Number(assetId))
        .currencyGreaterThan(Number(minAssetBalance))
        .limit(50)
        .do()
    for (const bal of res.balances ?? []) {
        const address = bal.address as string
        if (exclude.has(address)) continue
        if (bal.amount <= 0n) continue
        try {
            const info = await algod.accountInformation(address).do()
            const spendable = info.amount - info.minBalance
            if (spendable < minSpendableAlgos) continue
            return { address, assetBalance: BigInt(bal.amount) }
        } catch {
            continue
        }
    }
    return null
}

async function main(): Promise<void> {
    const algokit = AlgorandClient.fromClients({
        algod: new algosdk.Algodv2('', ALGOD_URL, ''),
        indexer: new algosdk.Indexer('', INDEXER_URL, ''),
    })
    algokit.setDefaultSigner(algosdk.makeEmptyTransactionSigner())
    const algod = algokit.client.algod
    const indexer = algokit.client.indexer

    try {
        await algod.status().do()
    } catch (e) {
        console.error(
            `BLOCKED: mainnet algod unreachable at ${ALGOD_URL}: ${(e as Error).message}`,
        )
        process.exit(1)
    }

    const fixture: Fixture = {}
    const concerns: string[] = []

    console.log(
        `Scanning ARC59 router (appId=${APP_ID}) boxes for pending inboxes...`,
    )
    const { claim, claimWithAlgo } = await findPendingInboxes(
        algod,
        indexer,
        5,
        80,
    )

    // --- claim (not opted in, no spare algo) ---
    if (claim) {
        console.log(
            `\nBuilding "claim" group: receiver=${claim.receiver} asset=${claim.assetId}`,
        )
        const txns = await buildClaimGroup(
            algokit,
            claim.receiver,
            claim.assetId,
            false,
            claim.optedIn,
        )
        printRefs('claim', txns)
        const sim = await strictSimulate(algod, txns)
        console.log(
            sim.pass
                ? 'STRICT SIMULATE PASSED (claim)'
                : `STRICT SIMULATE FAILED (claim): ${sim.message}`,
        )
        if (sim.pass) {
            fixture.claim = {
                receiver: claim.receiver,
                inbox: claim.inbox,
                assetId: claim.assetId.toString(),
                txns: extractRefs(txns),
            }
        } else {
            concerns.push(`claim: strict simulate failed: ${sim.message}`)
        }
    } else {
        concerns.push(
            'claim: no suitable pending inbox found (receiver not opted in, inbox with no spare ALGO)',
        )
    }

    // --- claimWithAlgo (inbox holds spare ALGO) ---
    if (claimWithAlgo) {
        console.log(
            `\nBuilding "claimWithAlgo" group: receiver=${claimWithAlgo.receiver} asset=${claimWithAlgo.assetId} spareAlgos=${claimWithAlgo.inboxSpareAlgos}`,
        )
        const txns = await buildClaimGroup(
            algokit,
            claimWithAlgo.receiver,
            claimWithAlgo.assetId,
            true,
            claimWithAlgo.optedIn,
        )
        printRefs('claimWithAlgo', txns)
        const sim = await strictSimulate(algod, txns)
        console.log(
            sim.pass
                ? 'STRICT SIMULATE PASSED (claimWithAlgo)'
                : `STRICT SIMULATE FAILED (claimWithAlgo): ${sim.message}`,
        )
        if (sim.pass) {
            fixture.claimWithAlgo = {
                receiver: claimWithAlgo.receiver,
                inbox: claimWithAlgo.inbox,
                assetId: claimWithAlgo.assetId.toString(),
                notes: `inbox held ${claimWithAlgo.inboxSpareAlgos} spare microAlgos above its MBR`,
                txns: extractRefs(txns),
            }
        } else {
            concerns.push(
                `claimWithAlgo: strict simulate failed: ${sim.message}`,
            )
        }
    } else {
        concerns.push(
            'claimWithAlgo: no pending inbox with spare ALGO found in scanned pages',
        )
    }

    // --- reject (reuse the "claim" pick; reject never needs opt-in) ---
    if (claim) {
        console.log(
            `\nBuilding "reject" group: receiver=${claim.receiver} asset=${claim.assetId}`,
        )
        const txns = await buildRejectGroup(
            algokit,
            claim.receiver,
            claim.assetId,
            false,
        )
        printRefs('reject', txns)
        const sim = await strictSimulate(algod, txns)
        console.log(
            sim.pass
                ? 'STRICT SIMULATE PASSED (reject)'
                : `STRICT SIMULATE FAILED (reject): ${sim.message}`,
        )
        if (sim.pass) {
            fixture.reject = {
                receiver: claim.receiver,
                inbox: claim.inbox,
                assetId: claim.assetId.toString(),
                txns: extractRefs(txns),
            }
        } else {
            concerns.push(`reject: strict simulate failed: ${sim.message}`)
        }
    } else {
        concerns.push('reject: skipped — no "claim" pick available to reuse')
    }

    // --- send (router already opted in to the asset) ---
    const sendReceiverPick = claim ?? claimWithAlgo
    if (sendReceiverPick) {
        const assetId = sendReceiverPick.assetId
        const routerInfo = await algod.accountInformation(ROUTER_ADDRESS).do()
        const routerOptedIn = (routerInfo.assets ?? []).some(
            a => BigInt(a.assetId) === assetId,
        )

        const holder = await findAssetHolder(
            algod,
            indexer,
            assetId,
            new Set([sendReceiverPick.inbox, ROUTER_ADDRESS]),
            100_000n,
            2n,
        )

        if (holder) {
            const amount = holder.assetBalance < 2n ? 1n : 2n
            const summary: SendSummary = {
                ...SYNTHESIZED_SEND_SUMMARY_BASE,
                is_arc59_opted_in: routerOptedIn,
            }
            console.log(
                `\nBuilding "send" group: sender=${holder.address} receiver=${sendReceiverPick.receiver} asset=${assetId} routerOptedIn=${routerOptedIn}`,
            )
            const txns = await buildSendGroup(
                algokit,
                holder.address,
                sendReceiverPick.receiver,
                assetId,
                amount,
                summary,
            )
            printRefs('send', txns)
            const sim = await strictSimulate(algod, txns)
            console.log(
                sim.pass
                    ? 'STRICT SIMULATE PASSED (send)'
                    : `STRICT SIMULATE FAILED (send): ${sim.message}`,
            )
            if (sim.pass) {
                fixture.send = {
                    sender: holder.address,
                    receiver: sendReceiverPick.receiver,
                    assetId: assetId.toString(),
                    notes:
                        'summary.minimum_balance_requirement/inner_tx_count/algo_fund_amount are synthesized ' +
                        '(no backend API key available to this tool) using this repo’s own unit-test baseline ' +
                        '(100000 / 2 / 0); is_arc59_opted_in reflects the real router account state for this asset.',
                    txns: extractRefs(txns),
                }
            } else {
                concerns.push(`send: strict simulate failed: ${sim.message}`)
            }
        } else {
            concerns.push(
                `send: no indexer-reported holder of asset ${assetId} found with sufficient spendable ALGO`,
            )
        }
    } else {
        concerns.push('send: skipped — no receiver/asset pick available')
    }

    // --- sendWithRouterOptIn (router NOT yet opted into the sent asset) ---
    // Best-effort / optional per the task brief. The router (a heavily-used
    // ARC59 instance) is already opted into >16k assets, so we can't find a
    // not-yet-opted-in asset among assets already circulating through it. We
    // instead scan recently created assets (via recent `acfg` transactions,
    // which report `createdAssetIndex`) — these haven't had a chance to be
    // routed through ARC59 yet — and check each against the router's live
    // opted-in set until we find one with a real holder.
    if (sendReceiverPick) {
        const routerInfo = await algod.accountInformation(ROUTER_ADDRESS).do()
        const routerAssetIds = new Set(
            (routerInfo.assets ?? []).map(a => BigInt(a.assetId).toString()),
        )
        const status = await algod.status().do()
        const currentRound = Number(status.lastRound)

        const candidateAssetIds: bigint[] = []
        let nextToken: string | undefined
        for (let page = 0; page < 10 && candidateAssetIds.length < 20; page++) {
            let req = indexer
                .searchForTransactions()
                .txType('acfg')
                .minRound(currentRound - 300_000)
                .limit(200)
            if (nextToken) req = req.nextToken(nextToken)
            const res = await req.do()
            for (const t of res.transactions) {
                const createdId = t.createdAssetIndex
                if (createdId === undefined || createdId === null) continue
                const idStr = BigInt(createdId).toString()
                if (!routerAssetIds.has(idStr))
                    candidateAssetIds.push(BigInt(createdId))
            }
            if (!res.nextToken) break
            nextToken = res.nextToken
        }
        console.log(
            `\nsendWithRouterOptIn: ${candidateAssetIds.length} recently-created candidate asset(s) not yet opted in by the router`,
        )

        let captured = false
        for (const assetId of candidateAssetIds) {
            const holder = await findAssetHolder(
                algod,
                indexer,
                assetId,
                new Set([ROUTER_ADDRESS]),
                150_000n,
                0n,
            )
            if (!holder) continue
            const receiver = sendReceiverPick.receiver
            const amount = holder.assetBalance < 2n ? 1n : 2n
            // Extra inner_tx_count headroom vs. the "send" baseline: this
            // variant also runs arc59_optRouterIn in the same atomic group
            // (which itself submits an inner self opt-in transaction), and
            // Algorand's fee pooling spends from one shared per-group credit
            // — the plain baseline undershot it in practice, so we pad here
            // to a value proven sufficient by strict simulate.
            const summary: SendSummary = {
                ...SYNTHESIZED_SEND_SUMMARY_BASE,
                inner_tx_count:
                    SYNTHESIZED_SEND_SUMMARY_BASE.inner_tx_count + 2,
                is_arc59_opted_in: false,
            }
            console.log(
                `\nBuilding "sendWithRouterOptIn" group: sender=${holder.address} receiver=${receiver} asset=${assetId}`,
            )
            const txns = await buildSendGroup(
                algokit,
                holder.address,
                receiver,
                assetId,
                amount,
                summary,
            )
            printRefs('sendWithRouterOptIn', txns)
            const sim = await strictSimulate(algod, txns)
            console.log(
                sim.pass
                    ? 'STRICT SIMULATE PASSED (sendWithRouterOptIn)'
                    : `STRICT SIMULATE FAILED (sendWithRouterOptIn): ${sim.message}`,
            )
            if (sim.pass) {
                fixture.sendWithRouterOptIn = {
                    sender: holder.address,
                    receiver,
                    assetId: assetId.toString(),
                    notes:
                        'summary synthesized as in "send"; is_arc59_opted_in forced false because the router ' +
                        'account was confirmed (live accountInformation) not opted into this asset.',
                    txns: extractRefs(txns),
                }
                captured = true
                break
            } else {
                concerns.push(
                    `sendWithRouterOptIn: candidate asset ${assetId} strict simulate failed: ${sim.message}`,
                )
            }
        }
        if (!captured) {
            concerns.push(
                'sendWithRouterOptIn: not captured — no candidate asset (held by a scanned inbox, not yet ' +
                    'opted into by the router, with a fundable holder) strict-simulated successfully',
            )
        }
    } else {
        concerns.push(
            'sendWithRouterOptIn: skipped — no receiver/asset pick available',
        )
    }

    mkdirSync(dirname(FIXTURE_PATH), { recursive: true })
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 4)}\n`)
    console.log(`\nFixture written to ${FIXTURE_PATH}`)

    console.log('\n=== Summary ===')
    console.log(
        `Flows captured: ${Object.keys(fixture).join(', ') || '(none)'}`,
    )
    if (concerns.length > 0) {
        console.log('Concerns:')
        concerns.forEach(c => console.log(`  - ${c}`))
    } else {
        console.log(
            'No concerns — all targeted flows captured and passed strict simulate.',
        )
    }
}

main().catch(e => {
    console.error('tool crashed:', e)
    process.exit(1)
})
