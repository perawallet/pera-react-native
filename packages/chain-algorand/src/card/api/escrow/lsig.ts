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

import { sha256 } from '@noble/hashes/sha2.js'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    bytesToHex,
    decodeFromBase64,
    type Network,
} from '@perawallet/wallet-core-shared'
import {
    AUTODRAW_TEAL_TEMPLATE,
    TMPL_GENESIS_HASH,
    TMPL_KILLSWITCH_APP,
    TMPL_MAIN_APP,
} from './autodraw-teal'
import { verifyAutoDrawTealTemplate } from './verify-teal'

/** The on-chain ids the AutoDraw template needs are missing from the build. */
export class CardEscrowNotConfiguredError extends AppError {
    constructor() {
        super('Pera Card chain config is incomplete (app ids / asset id)', {
            category: ErrorCategory.BLOCKCHAIN,
            recoverable: false,
        })
        this.name = 'CardEscrowNotConfiguredError'
    }
}

export type EscrowChainConfig = {
    /** Settlement asset id (USDC) as a decimal string. */
    assetId: string
    /** Killswitch application id as a decimal string. */
    killswitchAppId: string
    /** W3Card (main) application id as a decimal string. */
    mainAppId: string
}

/**
 * Resolves the on-chain ids the AutoDraw template needs. A missing id fails
 * closed in every environment: in TEAL `ApplicationID == 0` matches
 * app-CREATION transactions, so a program rendered with a placeholder id would
 * be a delegation gated by attacker-constructible transactions rather than an
 * unusable one.
 */
export const resolveEscrowChainConfig = (
    network: Network,
): EscrowChainConfig => {
    const { cardW3CardAppId, cardKillswitchAppId, cardUsdcAssetId } =
        getNetworkConfig(network)

    if (!cardW3CardAppId || !cardKillswitchAppId || !cardUsdcAssetId) {
        throw new CardEscrowNotConfiguredError()
    }

    return {
        assetId: cardUsdcAssetId,
        killswitchAppId: cardKillswitchAppId,
        mainAppId: cardW3CardAppId,
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
    return AUTODRAW_TEAL_TEMPLATE.replaceAll(
        TMPL_KILLSWITCH_APP,
        killswitchAppId,
    )
        .replaceAll(TMPL_MAIN_APP, mainAppId)
        .replaceAll(TMPL_GENESIS_HASH, genesisHashHex)
}

/** Thrown when algod's compiled AutoDraw program doesn't match the pinned hash. */
export class AutoDrawProgramUnverifiedError extends AppError {
    constructor(network: Network) {
        super(
            `AutoDraw program for ${network} does not match the pinned hash`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                recoverable: false,
                params: { network },
            },
        )
        this.name = 'AutoDrawProgramUnverifiedError'
    }
}

/**
 * Fails closed unless the SHA-256 of the compiled program matches the pin for
 * the network. Runs in EVERY environment — staging/testnet builds sign real user
 * keys too, so there is no production-only escape hatch. The pin lives in the
 * network config beside the app IDs it is derived from
 * (`cardAutoDrawProgramHash`); an unpinned network has an empty value and so
 * always rejects.
 *
 * A digest rather than the program bytes: it verifies just as strictly, is 64
 * chars instead of kilobytes, and avoids shipping a second copy of an artifact
 * the app already carries as `AUTODRAW_TEAL_TEMPLATE` and could drift from.
 *
 */
export const verifyAutoDrawProgram = (
    program: Uint8Array,
    network: Network,
    expected?: Partial<Record<Network, string>>,
): void => {
    const pinned = expected
        ? expected[network]
        : getNetworkConfig(network).cardAutoDrawProgramHash

    // Hex is case-insensitive; normalize so a pin pasted in upper case still
    // verifies instead of silently disabling AutoDraw.
    if (
        !pinned ||
        bytesToHex(sha256(program)) !== pinned.trim().toLowerCase()
    ) {
        throw new AutoDrawProgramUnverifiedError(network)
    }
}

/**
 * Renders the AutoDraw template for the network, compiles it via algod, and
 * returns the raw program bytes — after verifying them against the pinned
 * program. The *compiled bytes* (not the trusted template source) are what the
 * user delegates by signing, and algod is a third-party node, so its output is
 * checked before it can be signed.
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
    const program = decodeFromBase64(result)
    verifyAutoDrawProgram(program, network)
    return program
}
