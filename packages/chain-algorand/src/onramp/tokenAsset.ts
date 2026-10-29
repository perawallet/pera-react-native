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
    getKnownAssetId,
    type KnownAssetKey,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { RampTokenIdentity } from '@perawallet/wallet-core-onramp'
import { isAlgoAssetName, type Nullable } from '@perawallet/wallet-core-shared'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../descriptor'

// ALGO's SLIP-44 coin type, which its CAIP-19 id ends in.
const ALGO_CAIP19_ASSET = 'slip44:283'
// An ASA's CAIP-19 id ends `asa:<asset id>`.
const ASA_CAIP19_REFERENCE = /\/asa:(\d+)$/

// Catalogue ids the backend sends before it sends `caip19`; the ASA id differs
// per network, so the known-asset table resolves it.
const KNOWN_RAMP_TOKEN_ASSETS: Readonly<Record<string, KnownAssetKey>> = {
    USDC_ALGORAND: 'USDC',
}

// A numeric id is an on-chain id and wins; otherwise the catalogue id, which
// this adapter requests ALGO by, identifies it. The symbol is display text and
// never does.
export const isAlgorandNativeRampToken = (
    token: RampTokenIdentity,
): boolean => {
    if (token.caip19 !== undefined) {
        return token.caip19.endsWith(`/${ALGO_CAIP19_ASSET}`)
    }
    return /^\d+$/.test(token.id)
        ? isAlgorandNativeAssetId(token.id)
        : isAlgoAssetName(token.id)
}

/** The ASA id a ramp token arrives as on `scope`, as a decimal string; null when it has none there. */
export const algorandRampTokenAssetId = (
    token: RampTokenIdentity,
    scope: ChainScope,
): Nullable<string> => {
    if (isAlgorandNativeRampToken(token)) {
        return algorandDescriptor.nativeAsset.ref.assetId
    }
    const asaFromCaip19 = token.caip19?.match(ASA_CAIP19_REFERENCE)?.[1]
    if (asaFromCaip19 !== undefined) return asaFromCaip19
    if (/^\d+$/.test(token.id)) return token.id
    const knownAsset = KNOWN_RAMP_TOKEN_ASSETS[token.id]
    return knownAsset === undefined ? null : getKnownAssetId(knownAsset, scope)
}
