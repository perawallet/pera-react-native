/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-legacy-chain-in-app.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/apps/mobile/src/**/legacy-chain.*.ts'

// Delete an entry when its file is clean; never add one. Flip the rule to
// `error` when the list is empty.
const LEGACY_CHAIN_BASELINE: readonly string[] = [
    'apps/mobile/src/components/AccountDisplay/useAccountDisplay.ts',
    'apps/mobile/src/components/AccountIcon/useAccountIcon.ts',
    'apps/mobile/src/components/AccountWithBalance/useAccountWithBalance.ts',
    'apps/mobile/src/components/AddressDisplay/useAddressDisplay.ts',
    'apps/mobile/src/components/AddressListItem/AddressListItem.tsx',
    'apps/mobile/src/components/AssetSelector/AssetSelectorById/AssetSelectorById.tsx',
    'apps/mobile/src/components/PreferredAmount/ConvertedPreferredAmount/ConvertedPreferredAmount.tsx',
    'apps/mobile/src/components/PreferredAmount/PrecomputedPreferredAmount/PrecomputedPreferredAmount.tsx',
    'apps/mobile/src/components/PreferredAmount/usePreferredAmount.ts',
    'apps/mobile/src/components/RootComponent/RootContentContainer/RootContentContainer.tsx',
    'apps/mobile/src/components/TestnetIndicator/useTestnetIndicator.web.ts',
    'apps/mobile/src/hooks/useAccountTypeLabel.ts',
    'apps/mobile/src/hooks/useIsDataSigningBlocked.ts',
    'apps/mobile/src/hooks/useNetworkSwitchInvalidation.ts',
    'apps/mobile/src/hooks/useNfdResolve.ts',
    'apps/mobile/src/hooks/useQuantumDappWarning.tsx',
    'apps/mobile/src/hooks/useResolvedAddress.ts',
    'apps/mobile/src/modules/accounts/components/AccountDrawer/useAccountPickers.tsx',
    'apps/mobile/src/modules/accounts/components/AccountHistory/useAccountHistoryRows.ts',
    'apps/mobile/src/modules/accounts/components/AccountInfoCard/AccountTypeInfoContent/useAccountTypeInfo.ts',
    'apps/mobile/src/modules/accounts/components/AccountInfoCard/RekeyedToRow.tsx',
    'apps/mobile/src/modules/accounts/components/AccountInfoCard/useAccountInfoCard.ts',
    'apps/mobile/src/modules/accounts/components/AccountMenu/useAccountMenu.ts',
    'apps/mobile/src/modules/accounts/components/AccountNfts/useAccountNfts.tsx',
    'apps/mobile/src/modules/accounts/components/AccountOverview/useAccountOverview.tsx',
    'apps/mobile/src/modules/accounts/components/AccountOverview/useAccountOverviewHeader.ts',
    'apps/mobile/src/modules/accounts/components/AccountSortContent/DraggableAccountList.tsx',
    'apps/mobile/src/modules/accounts/components/AccountSortContent/useAccountSortContent.ts',
    'apps/mobile/src/modules/accounts/components/AccountTabNavigator/useAccountTabNavigator.ts',
    'apps/mobile/src/modules/accounts/components/BackupReminderBanner/useBackupReminderBanner.ts',
    'apps/mobile/src/modules/accounts/components/ButtonPanel/useButtonPanel.ts',
    'apps/mobile/src/modules/accounts/components/LegacyQuantumNotice/useLegacyQuantumNotice.ts',
    'apps/mobile/src/modules/accounts/components/PortfolioView/usePortfolioView.ts',
    'apps/mobile/src/modules/accounts/components/SharedAccountDetailsContent/useSharedAccountDetailsContent.ts',
    'apps/mobile/src/modules/accounts/components/WatchAccountButtonPanel/useWatchAccountButtonPanel.ts',
    'apps/mobile/src/modules/accounts/screens/RemoveAssetsScreen/useRemoveAssetsScreen.ts',
    'apps/mobile/src/modules/assets/components/AccountAssetSelectionList/useAccountAssetSelectionList.ts',
    'apps/mobile/src/modules/assets/components/AssetItem/AccountAssetItemView.tsx',
    'apps/mobile/src/modules/assets/components/OptInAccountSelectionContent/OptInAccountSelectionContent.tsx',
    'apps/mobile/src/modules/assets/components/market/AssetMarkets/AssetMarkets.tsx',
    'apps/mobile/src/modules/assets/components/market/PriceTrend/PriceTrend.tsx',
    'apps/mobile/src/modules/assets/hooks/useAssetListFiatConverter.ts',
    'apps/mobile/src/modules/backup/hooks/useBackupFlowLauncher.ts',
    'apps/mobile/src/modules/backup/hooks/useMnemonicForAddress.ts',
    'apps/mobile/src/modules/backup/hooks/useRandomMnemonicForAddress.ts',
    'apps/mobile/src/modules/backup/screens/BackupReminderMnemonicScreen/useBackupReminderMnemonicScreen.ts',
    'apps/mobile/src/modules/backup/screens/BackupVerificationScreen/useBackupVerificationScreen.ts',
    'apps/mobile/src/modules/card/components/PeraCardDetails/usePeraCardDetails.tsx',
    'apps/mobile/src/modules/card/hooks/useAuthorizeCardDelegation.tsx',
    'apps/mobile/src/modules/card/hooks/useCardAddAccount.ts',
    'apps/mobile/src/modules/card/hooks/useCardFundingAccount.ts',
    'apps/mobile/src/modules/card/hooks/useCardOwnerAccount.ts',
    'apps/mobile/src/modules/card/hooks/useCardScope.ts',
    'apps/mobile/src/modules/card/screens/CardAddFundsScreen/useCardAddFundsSwap.ts',
    'apps/mobile/src/modules/card/screens/CardAutoFundingSigningScreen/useCardAutoFundingSigningScreen.ts',
    'apps/mobile/src/modules/card/screens/CardCreateSigningScreen/useCardCreateSigningScreen.ts',
    'apps/mobile/src/modules/card/screens/CardSignInScreen/useCardSignInScreen.ts',
    'apps/mobile/src/modules/card/screens/PeraCardAccountScreen/usePeraCardAccountScreen.ts',
    'apps/mobile/src/modules/cloud-backup/components/BackupAccountRow/AccountSummaryLine.tsx',
    'apps/mobile/src/modules/cloud-backup/components/BackupAccountRow/BackupAccountRow.tsx',
    'apps/mobile/src/modules/cloud-backup/hooks/useBackupSyncLifecycle.ts',
    'apps/mobile/src/modules/cloud-backup/hooks/useProvenPasskeysQuery.ts',
    'apps/mobile/src/modules/cloud-backup/screens/CloudBackupRestoreEncryptionKeyScreen/useCloudBackupRestoreEncryptionKeyScreen.ts',
    'apps/mobile/src/modules/cloud-backup/screens/CloudBackupRestoreScanScreen/useCloudBackupRestoreScanScreen.tsx',
    'apps/mobile/src/modules/connections/providers/useConnectionsProvider.ts',
    'apps/mobile/src/modules/contacts/screens/ViewContactScreen/useViewContactScreen.tsx',
    'apps/mobile/src/modules/dapp/screens/SignRequestApprovalScreen/useSignRequestApprovalScreen.web.ts',
    'apps/mobile/src/modules/dapp/screens/WcConnectScreen/useWcConnectScreen.ts',
    'apps/mobile/src/modules/messages/components/InboxItem/AsaInboxItem/AsaInboxItem.tsx',
    'apps/mobile/src/modules/messages/components/InboxItem/MultisigSignInboxItem/useMultisigSignInboxItem.ts',
    'apps/mobile/src/modules/messages/components/MultisigInvitationDetailContent/useMultisigInvitationDetailContent.ts',
    'apps/mobile/src/modules/messages/components/NotificationsIcon/useNotificationsIcon.ts',
    'apps/mobile/src/modules/messages/hooks/useHandleMultisigNotification.ts',
    'apps/mobile/src/modules/messages/screens/InboxScreen/useInboxScreen.tsx',
    'apps/mobile/src/modules/messages/screens/MessagesScreen/useMessagesScreen.tsx',
    'apps/mobile/src/modules/messages/screens/MultisigInvitationNameScreen/useMultisigInvitationNameScreen.ts',
    'apps/mobile/src/modules/messages/screens/NotificationsScreen/useNotificationsScreen.ts',
    'apps/mobile/src/modules/migration/screens/MigrationSplashScreen/useMigrationSplashScreen.ts',
    'apps/mobile/src/modules/onboarding/hooks/useDelegationScanNoticeResult.ts',
    'apps/mobile/src/modules/onboarding/routes/add-account.tsx',
    'apps/mobile/src/modules/onboarding/routes/index.tsx',
    'apps/mobile/src/modules/onboarding/screens/AddAccountScreen/useAddAccountScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/AsbImportBackupScreen/useAsbImportBackupScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/AsbImportKeyScreen/useAsbImportKeyScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/AsbImportSelectAccountsScreen/useAsbImportSelectAccountsScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/ImportAccountOptionsScreen/useImportAccountOptionsScreen.tsx',
    'apps/mobile/src/modules/onboarding/screens/ImportAccountScreen/useImportAccountScreen.tsx',
    'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesItem.tsx',
    'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen.tsx',
    'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/RekeyedAccountInfoContent/RekeyedAccountInfoContent.tsx',
    'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/RekeyedAccountInfoContent/useRekeyedAccountInfoContent.ts',
    'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/useImportRekeyedAddressesScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/ImportSelectAddressesScreen/useImportSelectAddressesScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/NameAccountScreen/useNameAccountScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/OnboardingScreen/useOnboardingScreen.tsx',
    'apps/mobile/src/modules/onboarding/screens/PeraWebImportLoadingScreen/usePeraWebImportLoadingScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/SearchAccountsScreen/useSearchAccountsScreen.ts',
    'apps/mobile/src/modules/onboarding/screens/SelectHDWalletScreen/SelectHDWalletScreen.tsx',
    'apps/mobile/src/modules/onboarding/screens/SelectHDWalletScreen/useSelectHDWalletScreen.ts',
    'apps/mobile/src/modules/onramp/components/OnrampAmountSection/useOnrampAmountSection.ts',
    'apps/mobile/src/modules/onramp/components/OnrampSourceSelectionContent/useOnrampSourceSelection.ts',
    'apps/mobile/src/modules/projects/components/ApplicationDisplay/ApplicationDisplay.tsx',
    'apps/mobile/src/modules/prompts/hooks/useLegacyQuantumPrompt.ts',
    'apps/mobile/src/modules/rekey/components/RekeyConfirmView/RekeyConfirmView.tsx',
    'apps/mobile/src/modules/rekey/components/RekeySuccessScreen/useRekeySuccessScreen.ts',
    'apps/mobile/src/modules/rekey/components/RekeySummaryRow/RekeySummaryRow.tsx',
    'apps/mobile/src/modules/rekey/hooks/useRekeyConfirmScreen.tsx',
    'apps/mobile/src/modules/rekey/screens/rekey-to-ledger/RekeyToLedgerSelectTargetScreen/useRekeyToLedgerSelectTargetScreen.ts',
    'apps/mobile/src/modules/rekey/screens/rekey-to-quantum/RekeyToQuantumSelectTargetScreen/useRekeyToQuantumSelectTargetScreen.ts',
    'apps/mobile/src/modules/rekey/screens/rekey-to-shared/RekeyToSharedSelectTargetScreen/useRekeyToSharedSelectTargetScreen.ts',
    'apps/mobile/src/modules/rekey/screens/rekey-to-standard/RekeyToStandardSelectTargetScreen/useRekeyToStandardSelectTargetScreen.ts',
    'apps/mobile/src/modules/rekey/screens/rescan-rekeyed/DelegatedSweepSelectScreen/useDelegatedSweepSelectScreen.ts',
    'apps/mobile/src/modules/rekey/screens/undo-rekey/UndoRekeyConfirmScreen/UndoRekeyConfirmScreen.tsx',
    'apps/mobile/src/modules/rekey/screens/undo-rekey/UndoRekeyConfirmScreen/useUndoRekeyConfirmScreen.tsx',
    'apps/mobile/src/modules/search/screens/SearchScreen/SearchScreen.tsx',
    'apps/mobile/src/modules/search/screens/SearchScreen/useSearchScreen.tsx',
    'apps/mobile/src/modules/security/hooks/useDuressWipe.ts',
    'apps/mobile/src/modules/settings/screens/SettingsCurrencyScreen/useSettingsCurrencyScreen.ts',
    'apps/mobile/src/modules/settings/screens/SettingsScreen/useSettingsOptions.ts',
    'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperManageCacheScreen/SettingsDeveloperManageCacheScreen.tsx',
    'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/sections/AccountCard/AccountCard.tsx',
    'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/useRNMigrationSnapshot.ts',
    'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/useRunMigration.ts',
    'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperScreen/SettingsDeveloperScreen.tsx',
    'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/module-components.catalog.tsx',
    'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/screens.catalog.ts',
    'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/shared-components.catalog.tsx',
    'apps/mobile/src/modules/signing/components/ArbitraryDataSigningView/ArbitraryDataSigningDetailsView.tsx',
    'apps/mobile/src/modules/signing/components/BalanceImpactSummary/useBalanceImpactSummary.ts',
    'apps/mobile/src/modules/signing/components/MultipleArbitrarySignRequestView/MultipleArbitrarySignRequestView.tsx',
    'apps/mobile/src/modules/signing/components/SignRequestView/useSignRequestFailure.ts',
    'apps/mobile/src/modules/signing/components/SigningWarnings/WarningItem.tsx',
    'apps/mobile/src/modules/signing/components/SingleArbitrarySignRequestView/SingleArbitrarySignRequestView.tsx',
    'apps/mobile/src/modules/signing/components/SourceMetadataBadge/useSourceMetadataBadge.ts',
    'apps/mobile/src/modules/signing/screens/ArbitraryDataSigningScreen/useArbitraryDataSigningScreen.ts',
    'apps/mobile/src/modules/signing/screens/Arc60SigningDetailsScreen/Arc60SigningDetailsScreen.tsx',
    'apps/mobile/src/modules/signing/screens/Arc60SigningScreen/useArc60SigningScreen.ts',
    'apps/mobile/src/modules/staking/components/StakingProjectCard/StakingProjectCard.tsx',
    'apps/mobile/src/modules/staking/screens/StakingScreen/useStakingScreen.tsx',
    'apps/mobile/src/modules/swap/screens/SwapScreen/useSeedSwapRouteAssets.ts',
    'apps/mobile/src/modules/transactions/components/TransactionListItem/useTransactionListItem.ts',
    'apps/mobile/src/modules/transactions/hooks/send-funds/useSendScope.ts',
    'apps/mobile/src/modules/transactions/screens/receive-funds/AccountSelectionScreen/AccountSelectionScreen.tsx',
    'apps/mobile/src/modules/view-passphrase/components/ViewPassphraseContent/useViewPassphraseContent.ts',
    'apps/mobile/src/modules/walletconnect/components/ConnectionApprovalView/ConnectionApprovalViewHeader.tsx',
    'apps/mobile/src/modules/walletconnect/components/ConnectionApprovalView/useConnectionApprovalView.ts',
    'apps/mobile/src/modules/webview/hooks/bridge/useDataSigningHandler.ts',
    'apps/mobile/src/modules/webview/hooks/bridge/useGetAddressesHandler.ts',
    'apps/mobile/src/modules/webview/hooks/bridge/useSettingsHandlers.ts',
    'apps/mobile/src/modules/webview/hooks/bridge/useTransactionSigningHandler.ts',
    'apps/mobile/src/modules/webview/hooks/handlers-shared.ts',
    'apps/mobile/src/modules/webview/hooks/useContextFingerprints.ts',
    'apps/mobile/src/routes/WebMainRoutes.web.tsx',
    'apps/mobile/src/routes/index.tsx',
    'apps/mobile/src/routes/useTabResume.web.ts',
]

describe('pera/no-legacy-chain-in-app', () => {
    it('reports the import and every use of LEGACY_CHAIN_ID', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('legacy-chain.bad.ts')),
            ),
        ).toEqual(['legacy-chain.bad.ts:5', 'legacy-chain.bad.ts:9'])
    })

    it('ignores strings, comments, member access, bootstrap and modules/algorand', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => !v.file.endsWith('legacy-chain.bad.ts')),
        ).toEqual([])
    })

    it('reports exactly the baseline files across the app', async () => {
        const found = await runRule(RULE, 'apps/mobile/src/**/*.{ts,tsx}')

        expect([...new Set(found.map(v => v.file))].sort()).toEqual(
            LEGACY_CHAIN_BASELINE,
        )
    })
})
