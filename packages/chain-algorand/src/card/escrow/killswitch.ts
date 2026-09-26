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

import { decodeAddress } from 'algosdk'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import { FALLBACK_MIN_TXN_FEE } from '@perawallet/wallet-core-blockchain'
import type { CardAutoDraw } from '@perawallet/wallet-core-card'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import type { Network } from '@perawallet/wallet-core-shared'
import { cardAlgorandClient } from '../client'
import { isAlgodNotFoundError } from './algod'
import killswitchArc56 from './killswitch-arc56.json'

// AppliedBlockchain's Killswitch contract. The AutoDraw LSig only draws while
// the Killswitch holds an on-chain "accounts" box for the (funding account,
// asset) pair — created by `enable`, deleted by `kill`. The LSig no longer pins
// a single asset, so every call and the box key are keyed by both. Regenerate
// the vendored ARC-56 spec if AB changes the contract.
const KILLSWITCH_SPEC = killswitchArc56 as unknown as Arc56Contract

/**
 * Raw 32-byte address followed by the asset id as big-endian uint64 — how puya-ts
 * ARC-4-encodes a `[Account, Asset]` box-map key: static types concatenate
 * directly, no length prefix and no keyPrefix on this box map.
 */
const buildAccountAssetBoxName = (
    address: string,
    assetId: bigint,
): Uint8Array => {
    const key = new Uint8Array(40)
    key.set(decodeAddress(address).publicKey, 0)
    new DataView(key.buffer).setBigUint64(32, assetId)
    return key
}

const getAppClient = (network: Network, sender: string) => {
    const { cardKillswitchAppId } = getNetworkConfig(network)
    return cardAlgorandClient(network).client.getAppClientById({
        appId: BigInt(cardKillswitchAppId),
        appSpec: KILLSWITCH_SPEC,
        defaultSender: sender,
    })
}

export const algorandAutoDraw: CardAutoDraw = {
    // '0' is the dev placeholder, not a real app.
    isConfigured: network => {
        const { cardKillswitchAppId } = getNetworkConfig(network)
        return cardKillswitchAppId !== '' && cardKillswitchAppId !== '0'
    },

    // The sponsor covers the group fee (the backend simulates, so the inner
    // `getCardData` call is priced in) and tops up to min balance; the
    // accounts-box MBR comes from the Killswitch app account, not the sponsor.
    buildEnable: async ({ network, sender, cardAddress, asset }) => {
        const algokit = cardAlgorandClient(network)
        const appClient = getAppClient(network, sender)

        const composer = algokit.newGroup()
        composer.addAppCallMethodCall(
            await appClient.params.call({
                method: 'enable',
                args: [cardAddress, BigInt(asset)],
                // The call reaches the card's asset holding, which resource
                // population would otherwise discover as unnamed and then
                // place by JSON-stringifying every transaction field — a
                // path that throws on algosdk's native bigints (algokit
                // 9.2.x). Naming the pair short-circuits that scan.
                accountReferences: [cardAddress],
                assetReferences: [BigInt(asset)],
                // Simulate-only, and stripped after populating. The
                // resource-population simulate validates like a real
                // submission with no fee waiver, so a zero-fee group dies
                // with "group fee too small" before any resources are
                // discovered.
                staticFee: AlgoAmount.MicroAlgo(
                    Number(FALLBACK_MIN_TXN_FEE) * 2,
                ),
            }),
        )

        const { atc } = await composer.build()
        const populated = await populateAppCallResources(
            atc,
            algokit.client.algod,
        )
        return populated.buildGroup().map(({ txn }) => {
            // Fee-delegated: drop the simulate-only fee and any group id.
            // The backend re-groups the txns with the sponsor's fee/MBR
            // payment, recomputing the group id, so neither survives.
            txn.fee = 0n
            txn.group = undefined
            return txn
        })
    },

    buildKill: async ({ network, sender, asset }) => {
        const algokit = cardAlgorandClient(network)
        const appClient = getAppClient(network, sender)

        const composer = algokit.newGroup()
        composer.addAppCallMethodCall(
            await appClient.params.call({
                method: 'kill',
                args: [BigInt(asset)],
            }),
        )

        const { atc } = await composer.build()
        const populated = await populateAppCallResources(
            atc,
            algokit.client.algod,
        )
        return populated.buildGroup().map(t => t.txn)
    },

    // A present `accounts` box means enabled for that asset. `enable`/`kill`
    // assert ALREADY_ENABLED/ALREADY_DISABLED, and on the raw-composer path
    // those surface from the simulate as opaque "assert failed pc=NNN" errors,
    // since the ARC-56 mapping never runs.
    isEnabled: async ({ network, sender, asset }) => {
        const { cardKillswitchAppId } = getNetworkConfig(network)
        try {
            await cardAlgorandClient(network)
                .client.algod.getApplicationBoxByName(
                    BigInt(cardKillswitchAppId),
                    buildAccountAssetBoxName(sender, BigInt(asset)),
                )
                .do()
            return true
        } catch (error) {
            if (isAlgodNotFoundError(error)) return false
            throw error
        }
    },
}
