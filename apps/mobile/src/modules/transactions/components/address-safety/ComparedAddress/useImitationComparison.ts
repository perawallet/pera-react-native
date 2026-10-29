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

import { useMemo } from 'react'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import { useLanguage } from '@hooks/useLanguage'
import {
    diffAddresses,
    type AddressSegment,
} from '@modules/transactions/utils/diffAddresses'
import { KNOWN_LABEL_KEYS } from './knownAddressLabel'

export type UseImitationComparisonResult = {
    senderSegments: AddressSegment[]
    imitatedSegments: AddressSegment[]
    /** Names the imitated address by where the user knows it from. */
    imitatedLabel: string
}

export const useImitationComparison = ({
    suspectedPoisoning,
    scope,
}: {
    suspectedPoisoning: SuspectedPoisoning
    scope: ChainScope
}): UseImitationComparisonResult => {
    const { t } = useLanguage()
    const { counterparty, imitates } = suspectedPoisoning

    return useMemo(() => {
        const codec = addressCodecs.get(scope.chainId)
        const diff = diffAddresses(
            codec.normalize(counterparty),
            codec.normalize(imitates.address),
        )
        return {
            senderSegments: diff.a,
            imitatedSegments: diff.b,
            imitatedLabel: t(KNOWN_LABEL_KEYS[imitates.source], {
                name: imitates.name ?? codec.truncate(imitates.address),
            }),
        }
    }, [counterparty, imitates, scope.chainId, t])
}
