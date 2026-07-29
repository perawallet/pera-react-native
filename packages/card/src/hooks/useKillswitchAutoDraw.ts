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

import { useCallback } from 'react'
import { decodeAddress } from 'algosdk'
import {
    useAlgorandClient,
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig, type Network } from '@perawallet/wallet-core-config'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import killswitchArc56 from '../api/escrow/killswitch-arc56.json'

// SWAP POINT: AppliedBlockchain Killswitch contract (`enable(card,asset)` /
// `kill(asset)` / `authorize(account,asset)`). The AutoDraw delegated LSig
// only draws while the Killswitch holds an on-chain "accounts" box for the
// (funding account, asset) pair — created by `enable`, deleted by `kill`.
// Delegation is per-asset now (the LSig itself no longer pins a single asset),
// so every call and the box key below are keyed by (account, asset), not just
// account. Vendored ARC-56 spec + app id (`cardKillswitchAppId`) come from AB;
// regenerate the spec if the contract changes.
const KILLSWITCH_SPEC = killswitchArc56 as unknown as Arc56Contract

/**
 * Builds the Killswitch "accounts" box key for (account, asset): the raw
 * 32-byte address followed by the asset id as an 8-byte big-endian `uint64` —
 * matching how puya-ts ARC-4-encodes a `[Account, Asset]` box-map key (static
 * types concatenate directly, no length prefix, no keyPrefix on this box map).
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

/** True once a real Killswitch app id is configured (not the dev placeholder). */
export const isKillswitchConfigured = (network: Network): boolean => {
    const { cardKillswitchAppId } = getNetworkConfig(network)
    return cardKillswitchAppId !== '' && cardKillswitchAppId !== '0'
}

// A missing box is algod's HTTP 404 ("box not found"). Both the wallet's
// TimeoutHttpClient and algosdk's own client implement BaseHTTPClientError
// (`.response.status`); tolerate a bare `.status` too for robustness.
const isNotFoundError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error == null) return false
    const err = error as { status?: number; response?: { status?: number } }
    return err.response?.status === 404 || err.status === 404
}

export type UseKillswitchAutoDrawResult = {
    /**
     * Builds the unsigned `enable(card, asset)` call (one inner `getCardData`
     * call to verify card ownership), fee-delegation-ready: `staticFee` is
     * zeroed rather than self-funded, since the caller submits this via the
     * Pera backend's fee-delegation endpoint (`includeMbr: true`), which
     * sponsors both the accounts-box MBR and the group's total fee — the
     * enabling account needs no ALGO of its own. Resources (box, Main-app,
     * card-account refs) are populated via simulate.
     */
    buildEnable: (params: {
        sender: string
        cardAddress: string
        asset: string
    }) => Promise<PeraTransaction[]>
    /**
     * Builds the unsigned group to DISABLE auto-draw for (sender, asset):
     * `kill(asset)`, which deletes the caller's accounts box for that asset
     * (releasing its MBR). No funding, no inner txns.
     */
    buildKill: (params: {
        sender: string
        asset: string
    }) => Promise<PeraTransaction[]>
    /**
     * Reads the sender's on-chain auto-draw state for a given asset. The
     * Killswitch keeps one `accounts` box per enabled (account, asset) pair,
     * keyed by the raw 32-byte address followed by the 8-byte big-endian
     * asset id (no prefix), so a present box == enabled for that asset. Callers
     * MUST pre-check this instead of submitting and parsing reverts:
     * `enable`/`kill` assert ALREADY_ENABLED/ALREADY_DISABLED, and on our
     * raw-composer path those surface from the resource-population simulate as
     * opaque plain-`Error` "assert failed pc=NNN" messages (the ARC-56 error
     * mapping never runs). The AB demo uses the same avoidance strategy.
     * Network errors (non-404) are rethrown — an unknown state must not be
     * read as "disabled".
     */
    isAutoDrawEnabled: (params: {
        sender: string
        asset: string
    }) => Promise<boolean>
}

export const useKillswitchAutoDraw = (): UseKillswitchAutoDrawResult => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()

    const getAppClient = useCallback(
        (sender: string) => {
            const { cardKillswitchAppId } = getNetworkConfig(network)
            return algokit.client.getAppClientById({
                appId: BigInt(cardKillswitchAppId),
                appSpec: KILLSWITCH_SPEC,
                defaultSender: sender,
            })
        },
        [algokit, network],
    )

    const buildEnable = useCallback(
        async ({
            sender,
            cardAddress,
            asset,
        }: {
            sender: string
            cardAddress: string
            asset: string
        }): Promise<PeraTransaction[]> => {
            const appClient = getAppClient(sender)

            const composer = algokit.newGroup()
            composer.addAppCallMethodCall(
                await appClient.params.call({
                    method: 'enable',
                    args: [cardAddress, BigInt(asset)],
                    // Zero — the fee-delegation sponsor tops up the group's
                    // fee pool to cover this call AND its one inner
                    // `getCardData` call.
                    staticFee: AlgoAmount.MicroAlgo(0),
                }),
            )

            const { atc } = await composer.build()
            const populated = await populateAppCallResources(
                atc,
                algokit.client.algod,
            )
            return populated.buildGroup().map(t => t.txn)
        },
        [algokit, getAppClient],
    )

    const buildKill = useCallback(
        async ({
            sender,
            asset,
        }: {
            sender: string
            asset: string
        }): Promise<PeraTransaction[]> => {
            const appClient = getAppClient(sender)

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
        [algokit, getAppClient],
    )

    const isAutoDrawEnabled = useCallback(
        async ({
            sender,
            asset,
        }: {
            sender: string
            asset: string
        }): Promise<boolean> => {
            const { cardKillswitchAppId } = getNetworkConfig(network)
            try {
                await algokit.client.algod
                    .getApplicationBoxByName(
                        BigInt(cardKillswitchAppId),
                        buildAccountAssetBoxName(sender, BigInt(asset)),
                    )
                    .do()
                return true
            } catch (error) {
                if (isNotFoundError(error)) return false
                throw error
            }
        },
        [algokit, network],
    )

    return { buildEnable, buildKill, isAutoDrawEnabled }
}
