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
    FALLBACK_MIN_TXN_FEE,
    useAlgorandClient,
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig, type Network } from '@perawallet/wallet-core-config'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import killswitchArc56 from '../api/escrow/killswitch-arc56.json'

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
     * Fee-delegation-ready: `staticFee` is zeroed rather than self-funded, since
     * the caller submits via the backend's fee-delegation endpoint. The sponsor
     * covers the group fee (the backend simulates, so the inner `getCardData`
     * call is priced in) and tops up to min balance; the accounts-box MBR comes
     * from the Killswitch app account, not the sponsor.
     */
    buildEnable: (params: {
        sender: string
        cardAddress: string
        asset: string
    }) => Promise<PeraTransaction[]>
    /** Deletes the caller's accounts box for that asset, releasing its MBR. */
    buildKill: (params: {
        sender: string
        asset: string
    }) => Promise<PeraTransaction[]>
    /**
     * A present `accounts` box means enabled for that asset. Callers MUST
     * pre-check rather than submit and parse reverts: `enable`/`kill` assert
     * ALREADY_ENABLED/ALREADY_DISABLED, and on the raw-composer path those
     * surface from the simulate as opaque "assert failed pc=NNN" errors, since
     * the ARC-56 mapping never runs.
     *
     * Non-404 network errors rethrow — an unknown state must not read as
     * "disabled".
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
