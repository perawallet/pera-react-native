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

import { useCallback, useMemo } from 'react'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import type { AddressReuseGuard } from '@components/AddressReuseGuard'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    SuspectedAddressReuseWarningContent,
    type SuspectedAddressReuseDecision,
} from '../../components/address-safety/SuspectedAddressReuseWarningContent'

export type UseSuspectedAddressReuseGuardParams = {
    suspectedPoisoning: Optional<SuspectedPoisoning>
    scope: ChainScope
}

export const useSuspectedAddressReuseGuard = ({
    suspectedPoisoning,
    scope,
}: UseSuspectedAddressReuseGuardParams): AddressReuseGuard => {
    const { request } = useBottomSheet()

    const confirmReuse = useCallback(
        async (address: string) => {
            if (!suspectedPoisoning) return true
            const codec = addressCodecs.get(scope.chainId)
            if (
                !codec.isValid(address) ||
                !codec.areEqual(address, suspectedPoisoning.counterparty)
            ) {
                return true
            }
            const decision = await request<SuspectedAddressReuseDecision>({
                contents: (
                    <SuspectedAddressReuseWarningContent
                        suspectedPoisoning={suspectedPoisoning}
                        scope={scope}
                    />
                ),
                options: { size: 'auto' },
            })
            return decision === 'continue'
        },
        [suspectedPoisoning, scope, request],
    )

    return useMemo(() => ({ confirmReuse }), [confirmReuse])
}
