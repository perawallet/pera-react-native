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

import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import {
    FALLBACK_ASSET_MBR,
    FALLBACK_BASE_ACCOUNT_MBR,
    FALLBACK_MIN_TXN_FEE,
    FALLBACK_PQ_MULTIPLIER,
} from '../constants'

type UseMinimumFeeConfigResult = {
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
 * Runtime source of truth for minimum-fee and MBR values, in µAlgo (base
 * units). Reads remote config so node-side fee changes ship without an app
 * build; the hardcoded `FALLBACK_*` constants are used only when remote
 * config yields invalid values.
 */
export const useMinimumFeeConfig = (): UseMinimumFeeConfigResult => {
    const remoteConfig = useRemoteConfig()

    const readValue = (key: string, fallback: bigint): bigint =>
        toPositiveBigInt(
            remoteConfig.getNumberValue(key, Number(fallback)),
            fallback,
        )

    return {
        minTxnFee: readValue(
            RemoteConfigKeys.fee_min_txn_fee,
            FALLBACK_MIN_TXN_FEE,
        ),
        pqMultiplier: readValue(
            RemoteConfigKeys.fee_pq_multiplier,
            FALLBACK_PQ_MULTIPLIER,
        ),
        assetMbr: readValue(RemoteConfigKeys.fee_asset_mbr, FALLBACK_ASSET_MBR),
        baseAccountMbr: readValue(
            RemoteConfigKeys.fee_base_account_mbr,
            FALLBACK_BASE_ACCOUNT_MBR,
        ),
    }
}
