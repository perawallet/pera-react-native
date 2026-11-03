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
    type WalletAccount,
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
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
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
import { useSettledWidgetValue } from './useSettledWidgetValue'
import type { WidgetSnapshotWriterInput } from './useWidgetSnapshotWriter'

const namedAddressesOn = (
    accounts: readonly WalletAccount[],
    scope: ChainScope,
): { address: string; name: string }[] =>
    accounts.flatMap(account => {
        const address = addressOn(account, scope)
        return address
            ? [{ address, name: getAccountDisplayName(account, scope.chainId) }]
            : []
    })

// `asOf` is when the price was read, not what it is, so it doesn't count as a change.
const amountKeyOf = <T extends { asOf: number }>({ asOf: _, ...rest }: T) =>
    JSON.stringify(rest)

export const useWidgetSnapshotSources = (): WidgetSnapshotWriterInput => {
    const { t, currentLanguage } = useLanguage()
    const networkLabel = useNetworkLabel()
    // The widgets mirror one chain: the one whose portfolio chart the app draws.
    const scope = useSelectedScope(useCapableChainId('balanceHistory'))
    const backupScope = useSelectedScope(useCapableChainId('mnemonicBackup'))
    const deployment = useWalletDeployment()
    const isLive = deployment === 'live'
    const inboxDeviceId = useDeploymentDeviceID(deploymentOf(scope))
    const notificationsDeviceId = useDeploymentDeviceID(deployment)
    const hasInbox = useChainCapability(scope.chainId, 'notifications')
    const { privacyMode, theme } = useSettings()
    const { getPreference } = usePreferences()

    const accounts = useSigningAccounts(scope.chainId)
    const totals = useAccountValueTotalsQuery(accounts, scope)
    const currency = useCurrency(scope)
    const priceQuery = useNativeUsdPriceQuery(scope)
    const widgetAccounts = namedAddressesOn(accounts, scope)
    const addresses = widgetAccounts.map(account => account.address)
    const scopeIdentity = `${scope.chainId}/${scope.networkId}`
    const holdingsIdentity = `${scopeIdentity}/${addresses.join()}`
    const assetOptionsQuery = useWidgetAssetOptionsQuery(
        addresses,
        scope,
        !privacyMode,
    )
    const assetOptions = useSettledWidgetValue(assetOptionsQuery.options, {
        identity: holdingsIdentity,
        isError: assetOptionsQuery.isError,
    })
    const nftsQuery = useWidgetNftCandidatesQuery(
        addresses,
        scope,
        !privacyMode,
    )
    const nfts = useSettledWidgetValue(nftsQuery.candidates, {
        identity: holdingsIdentity,
        isError: nftsQuery.isError,
    })

    // Every account, not just signing ones: a rekey target can need its
    // passphrase backed up, the same as the in-app banner says.
    const allAccounts = useAccountsStore(state => state.accounts)
    const passphrase = useAccountsNeedingMnemonicBackup(
        allAccounts,
        backupScope,
    )
    const cloudBackup = useCloudBackupSummary()
    const receiveTargets = useWidgetReceiveTargets()
    // Every account: a shared account isn't a signing one, yet its requests are
    // labelled by its name and its invite is dropped once it's added.
    const accountNames = namedAddressesOn(allAccounts, scope)

    const amounts = resolveWidgetAmounts({
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
    const amountsIdentity = `${scopeIdentity}/${currency.preferredCurrency}`
    const algoPrice = useSettledWidgetValue(amounts.algoPrice, {
        identity: amountsIdentity,
        isError: priceQuery.isError,
        keyOf: amountKeyOf,
    })
    const portfolio = useSettledWidgetValue(amounts.portfolio, {
        identity: `${amountsIdentity}/${addresses.join()}`,
        isError: totals.isError,
        keyOf: amountKeyOf,
    })
    const backendUrl = getPeraServicesConfig(scope).backendUrl

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
            // The native side substitutes the number for `{count}`.
            inboxWaiting: t('widgets.inbox_waiting', { count: '{count}' }),
            inboxToSign: t('widgets.inbox_to_sign', { count: '{count}' }),
            inboxSign: t('widgets.inbox_sign'),
            inboxAssets: t('widgets.inbox_assets'),
            inboxInvite: t('widgets.inbox_invite'),
            cloudBackup: t('widgets.cloud_backup'),
            passphraseBackup: t('widgets.passphrase_backup'),
            notAvailable: t('widgets.not_available'),
        },
        priceFeed: resolvePriceFeed({
            backendUrl,
            apiKey: config.backendAPIKey,
            preferredCurrency: currency.preferredCurrency,
            pinning: backendUrl
                ? getProvider().widgets.backendPinning(backendUrl)
                : null,
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
        nfts,
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
            addresses,
            localAddresses: accountNames.map(account => account.address),
            accountNames,
            notificationsBackendUrl:
                getPeraDeploymentConfig(deployment).backendUrl,
            notificationsDeviceId,
        }),
    }
}
