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

import { config, getNetworkConfig } from '@perawallet/wallet-core-config'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    bytesToHex,
    decodeFromBase64,
    type Network,
} from '@perawallet/wallet-core-shared'
import { CardEscrowNotConfiguredError } from '../transport'
import {
    AUTODRAW_TEAL_TEMPLATE,
    TMPL_GENESIS_HASH,
    TMPL_KILLSWITCH_APP,
    TMPL_MAIN_APP,
} from './autodraw-teal'
import { verifyAutoDrawTealTemplate } from './verify-teal'

export type EscrowChainConfig = {
    /** Settlement asset id (USDC) as a decimal string. */
    assetId: string
    /** Killswitch application id as a decimal string. */
    killswitchAppId: string
    /** W3Card (main) application id as a decimal string. */
    mainAppId: string
}

/**
 * Resolves the AB escrow chain config for the AutoDraw template from network
 * config. Missing ids throw {@link CardEscrowNotConfiguredError} whenever a
 * REAL escrow service is in play (production, or any build with an escrow base
 * URL configured): a program rendered with app id `0` is not merely unusable —
 * in TEAL `ApplicationID == 0` matches app-CREATION transactions, so signing it
 * would grant a delegation gated by attacker-constructible transactions. The
 * `'0'` placeholders exist ONLY for the dev-mock path (empty base URL), where
 * the signed program never leaves the device.
 */
export const resolveEscrowChainConfig = (
    network: Network,
): EscrowChainConfig => {
    const {
        cardW3CardAppId,
        cardKillswitchAppId,
        cardUsdcAssetId,
        cardEscrowBaseUrl,
    } = getNetworkConfig(network)

    const hasAllIds = Boolean(
        cardW3CardAppId && cardKillswitchAppId && cardUsdcAssetId,
    )
    const isProduction = config.appEnvironment === 'production'
    if (!hasAllIds && (isProduction || cardEscrowBaseUrl)) {
        throw new CardEscrowNotConfiguredError()
    }

    return {
        assetId: cardUsdcAssetId || '0',
        killswitchAppId: cardKillswitchAppId || '0',
        mainAppId: cardW3CardAppId || '0',
    }
}

export type RenderAutoDrawTealArgs = EscrowChainConfig & {
    /** Base64 network genesis hash. */
    genesisHashBase64: string
}

/**
 * Substitutes the three `TMPL_` placeholders in the AutoDraw template. The
 * genesis hash becomes a `0x`-prefixed hex byte literal (TEAL bytecblock form),
 * matching AB's demo substitution. `assetId` is accepted (via
 * {@link EscrowChainConfig}) but not used here — the LSig no longer pins a
 * single asset at compile time; asset gating happens entirely through the
 * Killswitch's per-(account, asset) authorization instead. Callers still need
 * it to build the Killswitch `enable`/`kill` app calls.
 */
export const renderAutoDrawTeal = ({
    killswitchAppId,
    mainAppId,
    genesisHashBase64,
}: RenderAutoDrawTealArgs): string => {
    const genesisHashHex = `0x${bytesToHex(decodeFromBase64(genesisHashBase64))}`
    return AUTODRAW_TEAL_TEMPLATE.replaceAll(TMPL_KILLSWITCH_APP, killswitchAppId)
        .replaceAll(TMPL_MAIN_APP, mainAppId)
        .replaceAll(TMPL_GENESIS_HASH, genesisHashHex)
}

/**
 * Renders the AutoDraw template for the network and compiles it via algod,
 * returning the raw program bytes. This is the program the user delegates by
 * signing — compiled from a vendored template we control, so there is no
 * blind-signing of a server-supplied program (unlike the old delegation flow's
 * `verifyDelegationProgram`).
 */
export const compileAutoDrawProgram = async ({
    network,
}: {
    network: Network
}): Promise<Uint8Array> => {
    // Refuse to compile anything but the pinned, integrity-checked template —
    // the only program this delegation path is ever allowed to produce.
    verifyAutoDrawTealTemplate()

    const { genesisHash } = getNetworkConfig(network)
    const teal = renderAutoDrawTeal({
        ...resolveEscrowChainConfig(network),
        genesisHashBase64: genesisHash,
    })

    const { result } = await getAlgorandClient(network)
        .client.algod.compile(teal)
        .do()
    return decodeFromBase64(result)
}
