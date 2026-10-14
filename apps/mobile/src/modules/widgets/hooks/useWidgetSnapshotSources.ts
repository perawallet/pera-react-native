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
    useAccountValueTotalsQuery,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    useNetwork,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    useAlgoUsdPriceQuery,
    useCurrency,
} from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkLabel } from '@hooks/useNetworkLabel'
import { resolveWidgetAmounts } from '../amounts'
import { useWidgetNftCandidatesQuery } from './useWidgetNftCandidatesQuery'
import type { WidgetSnapshotWriterInput } from './useWidgetSnapshotWriter'

export const useWidgetSnapshotSources = (): WidgetSnapshotWriterInput => {
    const { t, currentLanguage } = useLanguage()
    const networkLabel = useNetworkLabel()
    const { network, isMainnet } = useNetwork()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { privacyMode, theme } = useSettings()

    const accounts = useSigningAccounts(LEGACY_CHAIN_ID)
    const totals = useAccountValueTotalsQuery(accounts, scope)
    const currency = useCurrency()
    const priceQuery = useAlgoUsdPriceQuery()
    const { candidates } = useWidgetNftCandidatesQuery(
        accounts.map(account => account.address),
        scope,
        !privacyMode,
    )

    const { algoPrice, portfolio } = resolveWidgetAmounts({
        preferredCurrency: currency.preferredCurrency,
        isRatePending: currency.isRatePending,
        usdToPreferred: currency.usdToPreferred,
        algoUsdPrice: currency.algoUsdPrice ?? priceQuery.data ?? null,
        isPricePending: priceQuery.isPending || priceQuery.isError,
        priceUpdatedAt: priceQuery.dataUpdatedAt,
        portfolioUsdValue: totals.portfolioUsdValue,
        portfolioNativeValue: totals.portfolioNativeValue,
        isPortfolioPending: totals.isPending || totals.isError,
    })

    return {
        locale: currentLanguage,
        theme,
        network: { isMainnet, label: networkLabel(network) },
        strings: {
            updated: t('widgets.updated'),
            hidden: t('widgets.hidden'),
            algoPrice: t('widgets.algo_price'),
            portfolio: t('portfolio.title'),
            nftsEmpty: t('widgets.nfts_empty'),
        },
        isPrivacyMode: privacyMode,
        hasAccounts: accounts.length > 0,
        algoPrice,
        portfolio,
        nfts: candidates,
    }
}
