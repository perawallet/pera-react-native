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
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'

const POLL_INTERVAL_MS = 1500
/** Generous: a swap lands within a round or two, but algod can lag behind the submit. */
const POLL_TIMEOUT_MS = 45_000

export class UsdcCreditTimeoutError extends Error {
    constructor() {
        super('USDC credit not observed in time')
        this.name = 'UsdcCreditTimeoutError'
    }
}

type WaitForUsdcCreditParams = {
    address: string
    /** Base units held before the swap. */
    before: bigint
    /** Base units that must have arrived; the quote's minimum output. */
    minimum: bigint
}

export type UseCardUsdcCreditResult = {
    /** The account's USDC holding in base units; 0 when not opted in. */
    readUsdcBalance: (address: string) => Promise<bigint>
    /** Resolves with the base units credited since `before` once `minimum` has landed. */
    waitForUsdcCredit: (params: WaitForUsdcCreditParams) => Promise<bigint>
}

/**
 * The swap groups pay their output to the swapper, and their submit resolves
 * at pool acceptance, so a deposit that follows a swap has to watch the
 * account until the USDC is actually there. The delta, not the quote, is what
 * gets deposited: the DEX may fill above the guaranteed minimum.
 */
export const useCardUsdcCredit = (): UseCardUsdcCreditResult => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()

    const readUsdcBalance = useCallback(
        async (address: string): Promise<bigint> => {
            const usdcAssetId = getKnownAssetId('USDC', network)
            if (usdcAssetId === null) return 0n
            const info = await algokit.client.algod
                .accountInformation(address)
                .do()
            const holding = info.assets?.find(
                asset => String(asset.assetId) === usdcAssetId,
            )
            return holding?.amount ?? 0n
        },
        [algokit, network],
    )

    const waitForUsdcCredit = useCallback(
        async ({
            address,
            before,
            minimum,
        }: WaitForUsdcCreditParams): Promise<bigint> => {
            const deadline = Date.now() + POLL_TIMEOUT_MS
            let delta = (await readUsdcBalance(address)) - before
            while (delta <= 0n || delta < minimum) {
                if (Date.now() >= deadline) throw new UsdcCreditTimeoutError()
                await new Promise(resolve =>
                    setTimeout(resolve, POLL_INTERVAL_MS),
                )
                delta = (await readUsdcBalance(address)) - before
            }
            return delta
        },
        [readUsdcBalance],
    )

    return { readUsdcBalance, waitForUsdcCredit }
}
