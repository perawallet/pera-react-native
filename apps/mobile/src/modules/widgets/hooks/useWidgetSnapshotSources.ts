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
    addressOn,
    getAccountDisplayName,
    useAccountsStore,
    useAccountValueTotalsQuery,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    config,
    deploymentOf,
    getPeraDeploymentConfig,
    getPeraServicesConfig,
} from '@perawallet/wallet-core-config'
import {
    useChainCapability,
    useSelectedScope,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    useCurrency,
    useNativeUsdPriceQuery,
} from '@perawallet/wallet-core-currencies'
import { useAccountsNeedingMnemonicBackup } from '@perawallet/wallet-core-backup'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { useCloudBackupSummary } from '@modules/cloud-backup'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkLabel } from '@hooks/useNetworkLabel'
import { UserPreferences } from '@constants/user-preferences'
import { resolveWidgetBackup } from '../backup'
import { resolveInboxFeed } from '../inbox'
import {
    resolvePortfolioFeed,
    resolvePriceFeed,
    resolveWidgetAmounts,
} from '../amounts'
import { useWidgetAssetOptionsQuery } from './useWidgetAssetOptionsQuery'
import { useWidgetNftCandidatesQuery } from './useWidgetNftCandidatesQuery'
import { useWidgetReceiveTargets } from './useWidgetReceiveTargets'
import type { WidgetSnapshotWriterInput } from './useWidgetSnapshotWriter'

export const useWidgetSnapshotSources = (): WidgetSnapshotWriterInput => {
    const { t, currentLanguage } = useLanguage()
    const networkLabel = useNetworkLabel()
    // The widgets mirror one chain: the one whose portfolio chart the app draws.
    const scope = useSelectedScope(useCapableChainId('balanceHistory'))
    const backupScope = useSelectedScope(useCapableChainId('mnemonicBackup'))
    const deployment = useWalletDeployment()
    // The widget's yellow bar matches the app's: any deployment that isn't live.
    const isLive = deployment === 'live'
    const inboxDeviceId = useDeploymentDeviceID(deploymentOf(scope))
    const notificationsDeviceId = useDeploymentDeviceID(deployment)
    // The app's inbox is gated on the same capability.
    const hasInbox = useChainCapability(scope.chainId, 'notifications')
    const { privacyMode, theme } = useSettings()
    const { getPreference } = usePreferences()

    const accounts = useSigningAccounts(scope.chainId)
    const totals = useAccountValueTotalsQuery(accounts, scope)
    const currency = useCurrency(scope)
    const priceQuery = useNativeUsdPriceQuery(scope)
    const widgetAccounts = accounts.flatMap(account => {
        const address = addressOn(account, scope)
        return address
            ? [
                  {
                      address,
                      name: getAccountDisplayName(account, scope.chainId),
                  },
              ]
            : []
    })
    const addresses = widgetAccounts.map(account => account.address)
    const { options: assetOptions } = useWidgetAssetOptionsQuery(
        addresses,
        scope,
        !privacyMode,
    )
    const { candidates } = useWidgetNftCandidatesQuery(
        addresses,
        scope,
        !privacyMode,
    )

    // Every account, not just signing ones: a rekey target can need its
    // passphrase backed up, the same as the in-app banner says.
    const allAccounts = useAccountsStore(state => state.accounts)
    const passphrase = useAccountsNeedingMnemonicBackup(
        allAccounts,
        backupScope,
    )
    const cloudBackup = useCloudBackupSummary()
    const receiveTargets = useWidgetReceiveTargets()
    // Every account, so a shared account's sign request is labelled by name.
    const accountNames = allAccounts.flatMap(account => {
        const address = addressOn(account, scope)
        return address
            ? [{ address, name: getAccountDisplayName(account, scope.chainId) }]
            : []
    })

    const { algoPrice, portfolio } = resolveWidgetAmounts({
        preferredCurrency: currency.preferredCurrency,
        isRatePending: currency.isRatePending,
        usdToPreferred: currency.usdToPreferred,
        algoUsdPrice: currency.nativeUsdPrice ?? priceQuery.data ?? null,
        isPricePending: priceQuery.isPending && !priceQuery.isError,
        isPriceError: priceQuery.isError,
        priceUpdatedAt: priceQuery.dataUpdatedAt,
        portfolioUsdValue: totals.portfolioUsdValue,
        portfolioNativeValue: totals.portfolioNativeValue,
        isPortfolioPending: totals.isPending || totals.isError,
    })

    return {
        locale: currentLanguage,
        theme,
        network: { isMainnet: isLive, label: networkLabel(scope.networkId) },
        strings: {
            updated: t('widgets.updated'),
            hidden: t('widgets.hidden'),
            algoPrice: t('widgets.algo_price'),
            portfolio: t('portfolio.title'),
            nftsEmpty: t('widgets.nfts_empty'),
            recentTransactions: t('widgets.recent_transactions'),
            noTransactions: t('widgets.no_transactions'),
            transaction: t('widgets.transaction'),
            txSend: t('transactions.list_item.send'),
            txReceive: t('transactions.list_item.receive'),
            txSwap: t('transactions.list_item.swap'),
            txOptIn: t('transactions.list_item.opt_in'),
            txOptOut: t('transactions.list_item.opt_out'),
            txAppCall: t('transactions.list_item.app_call'),
            tabPortfolio: t('widgets.tab_portfolio'),
            tabTransactions: t('widgets.tab_transactions'),
            inbox: t('widgets.inbox'),
            notifications: t('widgets.notifications'),
            inboxEmpty: t('widgets.inbox_empty'),
            notificationsEmpty: t('widgets.notifications_empty'),
            waiting: t('widgets.waiting'),
            toSign: t('widgets.to_sign'),
            inboxSign: t('widgets.inbox_sign'),
            inboxAssets: t('widgets.inbox_assets'),
            inboxInvite: t('widgets.inbox_invite'),
            cloudBackup: t('widgets.cloud_backup'),
            passphraseBackup: t('widgets.passphrase_backup'),
            notAvailable: t('widgets.not_available'),
        },
        priceFeed: resolvePriceFeed({
            backendUrl: getPeraServicesConfig(scope).backendUrl,
            apiKey: config.backendAPIKey,
            preferredCurrency: currency.preferredCurrency,
        }),
        portfolioFeed: resolvePortfolioFeed({
            accounts: widgetAccounts,
            storedPeriod: getPreference(UserPreferences.chartPeriod),
            isPrivacyMode: privacyMode,
        }),
        assetOptions,
        isPrivacyMode: privacyMode,
        hasAccounts: accounts.length > 0,
        algoPrice,
        portfolio,
        nfts: candidates,
        backup: resolveWidgetBackup({
            cloud: cloudBackup,
            passphrase: {
                needingCount: passphrase.accounts.length,
                isPending: passphrase.isPending,
            },
            locale: currentLanguage,
            t,
        }),
        receiveTargets,
        inboxFeed: resolveInboxFeed({
            isAvailable: hasInbox,
            isPrivacyMode: privacyMode,
            deviceId: inboxDeviceId,
            // The signing accounts, as the app's own inbox query asks about.
            addresses,
            accountNames,
            notificationsBackendUrl:
                getPeraDeploymentConfig(deployment).backendUrl,
            notificationsDeviceId,
        }),
    }
}
