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
import {
    useAlgorandClient,
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig, type Network } from '@perawallet/wallet-core-config'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import killswitchArc56 from '../api/escrow/killswitch-arc56.json'

// SWAP POINT: AppliedBlockchain Killswitch contract (`enable(card)` / `kill()`).
// The AutoDraw delegated LSig only draws while the Killswitch holds an on-chain
// "accounts" box for the funding account — created by `enable`, deleted by
// `kill`. Vendored ARC-56 spec + app id (`cardKillswitchAppId`) come from AB;
// regenerate the spec if the contract changes.
const KILLSWITCH_SPEC = killswitchArc56 as unknown as Arc56Contract

// Accounts-box MBR the caller funds on enable: 2500 + 400 * (32-byte address
// key + 8-byte uint64 value). Matches the demo's ACCOUNTS_BOX_MBR.
const ACCOUNTS_BOX_MBR = 18_500n
// Headroom over the exact MBR (matches the demo's funding buffer).
const FUNDING_BUFFER = 100_000n

/** True once a real Killswitch app id is configured (not the dev placeholder). */
export const isKillswitchConfigured = (network: Network): boolean => {
    const { cardKillswitchAppId } = getNetworkConfig(network)
    return cardKillswitchAppId !== '' && cardKillswitchAppId !== '0'
}

export type UseKillswitchAutoDrawResult = {
    /**
     * Builds the unsigned group to ENABLE auto-draw: fund the Killswitch app
     * account for the accounts-box MBR, then `enable(card)` (one inner
     * `getCardData` call to verify card ownership). Resources (box, Main-app,
     * card-account refs) are populated via simulate.
     */
    buildEnable: (params: {
        sender: string
        cardAddress: string
    }) => Promise<PeraTransaction[]>
    /**
     * Builds the unsigned group to DISABLE auto-draw: `kill()`, which deletes
     * the caller's accounts box (releasing its MBR). No funding, no inner txns.
     */
    buildKill: (params: { sender: string }) => Promise<PeraTransaction[]>
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
        }: {
            sender: string
            cardAddress: string
        }): Promise<PeraTransaction[]> => {
            const appClient = getAppClient(sender)
            const minFee = BigInt((await algokit.getSuggestedParams()).minFee)

            const composer = algokit.newGroup()
            composer.addPayment({
                sender,
                receiver: appClient.appAddress,
                amount: (ACCOUNTS_BOX_MBR + FUNDING_BUFFER).microAlgo(),
            })
            composer.addAppCallMethodCall(
                await appClient.params.call({
                    method: 'enable',
                    args: [cardAddress],
                    // Cover the one inner `getCardData` call to the Main app.
                    extraFee: minFee.microAlgo(),
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
        async ({ sender }: { sender: string }): Promise<PeraTransaction[]> => {
            const appClient = getAppClient(sender)

            const composer = algokit.newGroup()
            composer.addAppCallMethodCall(
                await appClient.params.call({ method: 'kill', args: [] }),
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

    return { buildEnable, buildKill }
}
