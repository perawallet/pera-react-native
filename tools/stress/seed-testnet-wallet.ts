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

import { readFileSync } from 'node:fs'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    countCreatedAssets,
    countSeederPayments,
    FUNGIBLE_UNIT_PREFIX,
    MAX_SEEDED_ASSETS,
    NFT_UNIT_PREFIX,
    PAYMENT_NOTE_PREFIX,
} from './chain-state'
import { deriveAddresses, hdSigner } from './derive'
import {
    MIN_BALANCE_MICROALGOS,
    planWalletSeed,
    seededBeyondTier,
    type StressSizes,
} from './plan'

const GROUP_SIZE = 16
// Groups sent at once. The chain confirms about one round in three seconds, so
// sending them one by one would spend most of a long run waiting.
const GROUPS_IN_FLIGHT = 4
const HOLDER_INDEX = 0
const TIERS_FILE = new URL('../../e2e/stress-tiers.json', import.meta.url)

type Tiers = { tiers: Record<string, StressSizes> }
type Group = ReturnType<AlgorandClient['newGroup']>

const usage = (): never => {
    console.error(
        'Usage: pnpm stress:seed --new\n' +
            '       pnpm stress:seed --tier <S|M|L|XL> --plan\n' +
            '       pnpm stress:seed --tier <S|M|L|XL>\n' +
            'Environment: STRESS_MNEMONIC (24 words), STRESS_FUNDER_MNEMONIC (25 words, a funded TestNet account)',
    )
    return process.exit(1)
}

const requireEnv = (name: string): string => {
    const value = process.env[name]
    if (!value) {
        console.error(`ERROR: ${name} is not set.`)
        process.exit(1)
    }
    return value as string
}

const algo = (microAlgo: bigint): number => Number(microAlgo) / 1_000_000

/** Fills groups of up to GROUP_SIZE transactions and sends a few groups at a time. */
const sendInGroups = async (
    algorand: AlgorandClient,
    label: string,
    count: number,
    add: (group: Group, index: number) => void,
): Promise<void> => {
    const groups: Array<() => Promise<unknown>> = []
    for (let from = 0; from < count; from += GROUP_SIZE) {
        const to = Math.min(from + GROUP_SIZE, count)
        const group = algorand.newGroup()
        for (let index = from; index < to; index++) add(group, index)
        groups.push(() => group.send())
    }
    let sent = 0
    for (let i = 0; i < groups.length; i += GROUPS_IN_FLIGHT) {
        await Promise.all(groups.slice(i, i + GROUPS_IN_FLIGHT).map(g => g()))
        sent = Math.min((i + GROUPS_IN_FLIGHT) * GROUP_SIZE, count)
        console.log(`${label}: ${sent} of ${count}`)
    }
}

const main = async (): Promise<void> => {
    const args = process.argv.slice(2)

    if (args.includes('--new')) {
        console.log(
            'New wallet phrase (shown once; store it as STRESS_MNEMONIC):',
        )
        console.log(generateMnemonic(wordlist, 256))
        return
    }

    const tier = args[args.indexOf('--tier') + 1]
    if (!args.includes('--tier') || !tier) return usage()
    const { tiers } = JSON.parse(readFileSync(TIERS_FILE, 'utf8')) as Tiers
    const sizes = tiers[tier]
    if (!sizes) {
        console.error(
            `ERROR: unknown tier "${tier}"; expected one of ${Object.keys(tiers).join(', ')}.`,
        )
        process.exit(1)
    }
    if (sizes.assets > MAX_SEEDED_ASSETS || sizes.nfts > MAX_SEEDED_ASSETS) {
        console.error(
            `ERROR: unit names leave room for ${MAX_SEEDED_ASSETS} assets of each kind.`,
        )
        process.exit(1)
    }

    const mnemonic = requireEnv('STRESS_MNEMONIC')
    // One past the tier, to tell a phrase seeded for a bigger tier from one for this tier.
    const derived = await deriveAddresses(mnemonic, sizes.accounts + 1)
    const addresses = derived.slice(0, sizes.accounts)
    const nextAddress = derived[sizes.accounts]
    const holderAddress = addresses[HOLDER_INDEX]
    const algorand = AlgorandClient.testNet()

    const funded = new Set<number>()
    let holderSpendable = 0n
    for (const [index, address] of addresses.entries()) {
        // algod answers an address it has never seen with an empty account rather
        // than an error, so an account exists once it holds a balance.
        const info = await algorand.client.algod
            .accountInformation(address)
            .do()
        if (info.amount > 0n) funded.add(index)
        if (index === HOLDER_INDEX && info.amount > info.minBalance) {
            holderSpendable = info.amount - info.minBalance
        }
    }
    const created = await countCreatedAssets(algorand, holderAddress)
    const paymentsSent = await countSeederPayments(algorand, holderAddress)

    const state = {
        funded,
        assetsCreated: created.assets,
        nftsCreated: created.nfts,
        paymentsSent,
        holderSpendableMicroAlgos: holderSpendable,
    }
    const nextAccount = await algorand.client.algod
        .accountInformation(nextAddress)
        .do()
    const tooBig = seededBeyondTier(sizes, state, nextAccount.amount > 0n)
    if (tooBig.length > 0) {
        console.error(
            `ERROR: this STRESS_MNEMONIC was seeded for a bigger tier than ${tier}:\n` +
                tooBig.map(reason => `  - ${reason}`).join('\n') +
                '\nGive each tier a phrase of its own (pnpm stress:seed --new). Nothing was sent.',
        )
        process.exit(1)
    }

    const plan = planWalletSeed(sizes, state)
    console.log(
        `Tier ${tier}: ${sizes.accounts} accounts (${funded.size} on TestNet), ` +
            `${sizes.assets} assets (${created.assets} created), ${sizes.nfts} NFTs (${created.nfts} created), ` +
            `${sizes.transactions} payments (${paymentsSent} sent).`,
    )
    console.log(
        `To do: fund ${plan.toFund.length} accounts, create ${plan.assetsToCreate} assets and ` +
            `${plan.nftsToCreate} NFTs, send ${plan.paymentsToSend} payments.`,
    )
    console.log(`Account 0 holds it all: ${holderAddress}`)
    console.log(
        `Funder needs ${algo(plan.requiredMicroAlgos)} ALGO for this run.`,
    )
    const isDone =
        plan.toFund.length +
            plan.assetsToCreate +
            plan.nftsToCreate +
            plan.paymentsToSend ===
        0
    if (args.includes('--plan') || isDone) return

    const funder = algorand.account.fromMnemonic(
        requireEnv('STRESS_FUNDER_MNEMONIC'),
    )
    const funderInfo = await algorand.account.getInformation(funder.addr)
    // The funder keeps its own minimum balance, so only the rest is spendable.
    const spendable =
        funderInfo.balance.microAlgos - funderInfo.minBalance.microAlgos
    if (spendable < plan.requiredMicroAlgos) {
        console.error(
            `ERROR: funder ${funder.addr} can spend ${algo(spendable)} ALGO; ` +
                `this run needs ${algo(plan.requiredMicroAlgos)}. Nothing was sent.`,
        )
        process.exit(1)
    }

    // The holder signs its own creations and payments with its HD key.
    const holder = await hdSigner(mnemonic, HOLDER_INDEX)
    algorand.setSigner(holder.address, holder.signer)

    // Accounts first, the holder's top-up riding on its own payment, so it can pay for what follows.
    const funding = plan.toFund.map(index => ({
        index,
        amount:
            (index === HOLDER_INDEX ? plan.holderTopUpMicroAlgos : 0n) +
            MIN_BALANCE_MICROALGOS,
    }))
    if (
        plan.holderTopUpMicroAlgos > 0n &&
        !plan.toFund.includes(HOLDER_INDEX)
    ) {
        funding.push({
            index: HOLDER_INDEX,
            amount: plan.holderTopUpMicroAlgos,
        })
    }
    await sendInGroups(algorand, 'Funded', funding.length, (group, i) =>
        group.addPayment({
            sender: funder,
            receiver: addresses[funding[i].index],
            amount: microAlgos(funding[i].amount),
        }),
    )

    await sendInGroups(algorand, 'Assets', plan.assetsToCreate, (group, i) => {
        const n = created.assets + i
        group.addAssetCreate({
            sender: holder.address,
            total: 1_000_000_000_000n,
            decimals: 6,
            assetName: `Pera Stress Asset ${n}`,
            unitName: `${FUNGIBLE_UNIT_PREFIX}${n}`,
        })
    })

    await sendInGroups(algorand, 'NFTs', plan.nftsToCreate, (group, i) => {
        const n = created.nfts + i
        const url = `https://picsum.photos/seed/pera-stress-${n}/600/600`
        group.addAssetCreate({
            sender: holder.address,
            total: 1n,
            decimals: 0,
            assetName: `Pera Stress NFT #${n}`,
            unitName: `${NFT_UNIT_PREFIX}${n}`,
            url,
            note: JSON.stringify({
                standard: 'arc69',
                description: 'Pera stress-test NFT',
                mime_type: 'image/jpeg',
                media_url: url,
            }),
        })
    })

    await sendInGroups(algorand, 'Payments', plan.paymentsToSend, (group, i) =>
        group.addPayment({
            sender: holder.address,
            receiver: holder.address,
            amount: microAlgos(0),
            // Each note is unique, so no two payments share a transaction id.
            note: `${PAYMENT_NOTE_PREFIX}${paymentsSent + i}`,
        }),
    )
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
