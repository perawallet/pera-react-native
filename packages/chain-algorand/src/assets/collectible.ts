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

import type { Decimal } from 'decimal.js'
import type { CollectibleStandard } from '@perawallet/wallet-core-assets'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'

type AsaSupply = { totalSupply: Decimal; decimals: number }

export const AlgorandCollectibleStandard = {
    arc3: 'arc3',
    arc69: 'arc69',
} as const satisfies Record<string, CollectibleStandard>

/** A pure (non-fractional) NFT per ARC-3: 1 total supply, 0 decimals. */
export const isUniqueAlgorandCollectible = ({
    totalSupply,
    decimals,
}: AsaSupply): boolean => totalSupply.eq(1) && decimals === 0

/**
 * Whether an ASA is shaped like an NFT. Used only to decide whether re-asking
 * the backend about an unclassified asset is worthwhile — never as a
 * classification, since the backend's type is the only answer that counts.
 *
 * NFTs are indivisible, whether one-of-one or an edition of many. The lone
 * exception is ARC-3's fractional NFT, which holds exactly 10^decimals units.
 */
export const hasAlgorandNftShape = ({
    totalSupply,
    decimals,
}: AsaSupply): boolean =>
    decimals === 0 || baseUnitsToDisplayUnits(totalSupply, decimals).eq(1)
