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

import type { ChainRemoteConfigValue } from '@perawallet/wallet-core-chain-contract'
import type { RemoteConfigService } from '@perawallet/wallet-extension-platform'
import {
    FALLBACK_ASSET_MBR,
    FALLBACK_BASE_ACCOUNT_MBR,
    FALLBACK_MIN_TXN_FEE,
    FALLBACK_PQ_MULTIPLIER,
} from './constants'

export const AlgorandRemoteConfigKeys = {
    fee_min_txn_fee: 'fee_min_txn_fee',
    fee_pq_multiplier: 'fee_pq_multiplier',
    fee_asset_mbr: 'fee_asset_mbr',
    fee_base_account_mbr: 'fee_base_account_mbr',
    enable_quantum_swap: 'enable_quantum_swap',
    enable_quantum_dapp_warning: 'enable_quantum_dapp_warning',
    enable_ssl_pinning_algod: 'enable_ssl_pinning_algod',
} as const

export type AlgorandRemoteConfigKey =
    (typeof AlgorandRemoteConfigKeys)[keyof typeof AlgorandRemoteConfigKeys]

export const algorandRemoteConfigDefaults: Readonly<
    Record<AlgorandRemoteConfigKey, ChainRemoteConfigValue>
> = {
    // Minimum transaction fee in µAlgo.
    fee_min_txn_fee: 1000,
    // Multiplier applied to the minimum fee for post-quantum signers.
    fee_pq_multiplier: 3,
    // Additional minimum balance requirement per opted-in asset, in µAlgo.
    fee_asset_mbr: 100_000,
    // Base minimum balance requirement for any account, in µAlgo.
    fee_base_account_mbr: 100_000,
    // Rollout gate and kill switch for swapping FROM quantum accounts. The
    // backend must price the pqsig fee surcharge into prepared swap groups
    // (the app cannot raise fees there — a re-group would invalidate the
    // backend's pre-signed slots), so this stays off until Firebase turns it
    // on, and flipping it off restores the pre-rollout guard.
    enable_quantum_swap: false,
    enable_quantum_dapp_warning: true,
    // Same contract as enable_ssl_pinning_pera_api, but for the Algorand node/indexer
    // (Nodely) hosts — a separate kill switch so a node-side CA surprise can be
    // disabled without also dropping backend pinning, and vice versa.
    enable_ssl_pinning_algod: false,
}

export interface AlgorandFeeConfig {
    /** Minimum transaction fee in µAlgo (base units). */
    minTxnFee: bigint
    /** Fee multiplier applied to transactions signed by post-quantum signers. */
    pqMultiplier: bigint
    /** Additional minimum balance requirement per opted-in asset, in µAlgo (base units). */
    assetMbr: bigint
    /** Base minimum balance requirement for any account, in µAlgo (base units). */
    baseAccountMbr: bigint
}

/**
 * Converts a remote-config number to bigint, falling back when the value is
 * non-finite or not strictly positive. Values are small (≤ 100,000 µAlgo) so
 * `BigInt(Math.round(value))` is lossless.
 */
const toPositiveBigInt = (value: number, fallback: bigint): bigint => {
    if (!Number.isFinite(value) || value <= 0) {
        return fallback
    }
    return BigInt(Math.round(value))
}

/**
 * Minimum-fee and MBR values in µAlgo (base units). Remote config lets
 * node-side fee changes ship without an app build; the `FALLBACK_*` constants
 * apply only when it yields invalid values.
 */
export const readAlgorandFeeConfig = (
    remoteConfig: Pick<RemoteConfigService, 'getNumberValue'>,
): AlgorandFeeConfig => {
    const readValue = (key: AlgorandRemoteConfigKey, fallback: bigint) =>
        toPositiveBigInt(
            remoteConfig.getNumberValue(key, Number(fallback)),
            fallback,
        )

    return {
        minTxnFee: readValue(
            AlgorandRemoteConfigKeys.fee_min_txn_fee,
            FALLBACK_MIN_TXN_FEE,
        ),
        pqMultiplier: readValue(
            AlgorandRemoteConfigKeys.fee_pq_multiplier,
            FALLBACK_PQ_MULTIPLIER,
        ),
        assetMbr: readValue(
            AlgorandRemoteConfigKeys.fee_asset_mbr,
            FALLBACK_ASSET_MBR,
        ),
        baseAccountMbr: readValue(
            AlgorandRemoteConfigKeys.fee_base_account_mbr,
            FALLBACK_BASE_ACCOUNT_MBR,
        ),
    }
}
