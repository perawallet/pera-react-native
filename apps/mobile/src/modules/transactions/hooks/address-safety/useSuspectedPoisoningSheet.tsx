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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SuspectedPoisoningNotice } from '../../components/address-safety/SuspectedPoisoningNotice'

export type UseSuspectedPoisoningSheetResult = {
    openSuspectedPoisoningSheet: (
        suspectedPoisoning: SuspectedPoisoning,
        scope: ChainScope,
    ) => void
}

// For a chain with no transaction detail screen, the explanation opens here
// instead; it offers no copy, so the address is never one tap from reuse.
export const useSuspectedPoisoningSheet =
    (): UseSuspectedPoisoningSheetResult => {
        const { request } = useBottomSheet()

        const openSuspectedPoisoningSheet = useCallback(
            (suspectedPoisoning: SuspectedPoisoning, scope: ChainScope) => {
                void request({
                    contents: (
                        <SuspectedPoisoningNotice
                            suspectedPoisoning={suspectedPoisoning}
                            scope={scope}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
            },
            [request],
        )

        return { openSuspectedPoisoningSheet }
    }
