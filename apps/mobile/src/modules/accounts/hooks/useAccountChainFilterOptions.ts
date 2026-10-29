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
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useLanguage } from '@hooks/useLanguage'
import { toChainFilterOptions } from '@modules/assets'

/** The All + per-network chips for an account's tabs; empty on a single-network account. */
export const useAccountChainFilterOptions = (
    sources: readonly AccountHoldingSource[],
    testIDPrefix: string,
): FilterOption<Nullable<ChainId>>[] => {
    const { t } = useLanguage()
    return useMemo(
        () =>
            toChainFilterOptions(
                sources.map(({ scope: { chainId } }) => chainId),
                {
                    allLabel: t('account_details.assets.network_filter_all'),
                    testIDPrefix,
                },
            ),
        [sources, t, testIDPrefix],
    )
}
