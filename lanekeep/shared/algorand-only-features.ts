/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

export interface AlgorandOnlyFeature {
    // Repo-relative path.
    file: string
    reason: string
}

const entries = (
    reason: string,
    files: readonly string[],
): AlgorandOnlyFeature[] => files.map(file => ({ file, reason }))

// The app files that name Algorand's chain on purpose: the feature exists only
// there, so the chain is a fact of the feature rather than a default. Chain-neutral
// code takes its chain from its caller instead, and never goes on this list.
// A new entry needs a reason; `src/components/**` and `src/hooks/**` are never listed.

const REKEY =
    "Rekey is Algorand's: only chain-algorand declares the rekey capability."

const LEGACY_QUANTUM =
    'Legacy quantum (Falcon) accounts exist only on Algorand.'

const MULTISIG =
    'Algorand multisig: only chain-algorand registers a multisig adapter.'

const INBOX =
    "The inbox (ASA inbox and multisig requests) is Algorand's, served by its Pera backend."

const ASSET_OPT_OUT =
    'ASA opt-out: only Algorand declares the manageAssets capability.'

const PERA_CARD =
    'Pera Card is Algorand-backed: its escrow, funding account and USDC are on Algorand.'

const BACKUP_FORMAT =
    "A cloud-backup item without chain records is in Algorand's format, and Algorand registers the only backup adapter."

const PASSKEY_SEED_REF =
    "Passkeys join seeds through Algorand's seed reference."

const ALGORAND_SIGN_PATHS =
    "WalletConnect v1 and transaction-group signing are Algorand's; other chains' sends route by the message's own chain."

const DAPP_REGISTRY =
    "Only Algorand's Pera backend serves the dApp registry, keyed by URL, so every chain's proposal is checked against it there."

const LEGACY_APP =
    'The old native app being migrated held only Algorand accounts.'

const ALGORAND_IMPORT =
    'Algorand Secure Backup, Pera Web and Algorand mnemonic imports hold Algorand accounts.'

const APPLICATIONS =
    "Algorand application ids, rendered only by Algorand's app-call UI."

const DEV_FIXTURES =
    "Developer tooling whose fixtures are Algorand's: the testnet dispenser, ASA ids and the ALGO/USDC pair."

const ARBITRARY_DATA =
    'Arbitrary-data and ARC-60 signing are Algorand standards.'

const STAKING = "Staking projects are Algorand's."

const WEBVIEW_BRIDGE =
    'The Pera webview bridge speaks ARC-0001, which only Algorand serves.'

export const ALGORAND_ONLY_FEATURES: readonly AlgorandOnlyFeature[] = [
    ...entries(REKEY, [
        'apps/mobile/src/modules/accounts/components/AccountInfoCard/RekeyedToRow.tsx',
        'apps/mobile/src/modules/onboarding/hooks/useDelegationScanNoticeResult.ts',
        'apps/mobile/src/modules/onboarding/routes/add-account.tsx',
        'apps/mobile/src/modules/onboarding/routes/index.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesItem.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/RekeyedAccountInfoContent/RekeyedAccountInfoContent.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/RekeyedAccountInfoContent/useRekeyedAccountInfoContent.ts',
        'apps/mobile/src/modules/onboarding/screens/ImportRekeyedAddressesScreen/useImportRekeyedAddressesScreen.ts',
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
        'apps/mobile/src/modules/settings/screens/SettingsScreen/useSettingsOptions.ts',
        'apps/mobile/src/routes/WebMainRoutes.web.tsx',
        'apps/mobile/src/routes/index.tsx',
    ]),
    ...entries(LEGACY_QUANTUM, [
        'apps/mobile/src/modules/accounts/components/LegacyQuantumNotice/useLegacyQuantumNotice.ts',
        'apps/mobile/src/modules/prompts/hooks/useLegacyQuantumPrompt.ts',
        'apps/mobile/src/modules/walletconnect/components/ConnectionApprovalView/useConnectionApprovalView.ts',
    ]),
    ...entries(MULTISIG, [
        'apps/mobile/src/modules/accounts/components/SharedAccountDetailsContent/useSharedAccountDetailsContent.ts',
        'apps/mobile/src/modules/messages/components/InboxItem/MultisigSignInboxItem/useMultisigSignInboxItem.ts',
        'apps/mobile/src/modules/messages/components/MultisigInvitationDetailContent/useMultisigInvitationDetailContent.ts',
        'apps/mobile/src/modules/messages/hooks/useHandleMultisigNotification.ts',
        'apps/mobile/src/modules/messages/screens/MultisigInvitationNameScreen/useMultisigInvitationNameScreen.ts',
    ]),
    ...entries(INBOX, [
        'apps/mobile/src/modules/messages/components/InboxItem/AsaInboxItem/AsaInboxItem.tsx',
        'apps/mobile/src/modules/messages/components/NotificationsIcon/useNotificationsIcon.ts',
        'apps/mobile/src/modules/messages/screens/InboxScreen/useInboxScreen.tsx',
        'apps/mobile/src/modules/messages/screens/MessagesScreen/useMessagesScreen.tsx',
        'apps/mobile/src/modules/messages/screens/NotificationsScreen/useNotificationsScreen.ts',
    ]),
    ...entries(ASSET_OPT_OUT, [
        'apps/mobile/src/modules/accounts/screens/RemoveAssetsScreen/useRemoveAssetsScreen.tsx',
    ]),
    ...entries(PERA_CARD, [
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
    ]),
    ...entries(BACKUP_FORMAT, [
        'apps/mobile/src/modules/cloud-backup/components/BackupAccountRow/BackupAccountRow.tsx',
        'apps/mobile/src/modules/cloud-backup/hooks/useBackupSyncLifecycle.ts',
        'apps/mobile/src/modules/cloud-backup/screens/CloudBackupRestoreEncryptionKeyScreen/useCloudBackupRestoreEncryptionKeyScreen.ts',
        'apps/mobile/src/modules/cloud-backup/screens/CloudBackupRestoreScanScreen/useCloudBackupRestoreScanScreen.tsx',
    ]),
    ...entries(PASSKEY_SEED_REF, [
        'apps/mobile/src/modules/cloud-backup/hooks/useProvenPasskeysQuery.ts',
    ]),
    ...entries(ALGORAND_SIGN_PATHS, [
        'apps/mobile/src/modules/connections/providers/useConnectionsProvider.ts',
        'apps/mobile/src/modules/dapp/screens/SignRequestApprovalScreen/useSignRequestApprovalScreen.web.ts',
    ]),
    ...entries(DAPP_REGISTRY, [
        'apps/mobile/src/modules/dapp/screens/WcConnectScreen/useWcConnectScreen.ts',
        'apps/mobile/src/modules/walletconnect/components/ConnectionApprovalView/ConnectionApprovalViewHeader.tsx',
    ]),
    ...entries(LEGACY_APP, [
        'apps/mobile/src/modules/migration/screens/MigrationSplashScreen/useMigrationSplashScreen.ts',
        'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/sections/AccountCard/AccountCard.tsx',
        'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/useRNMigrationSnapshot.ts',
        'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperMigrationViewerScreen/useRunMigration.ts',
    ]),
    ...entries(ALGORAND_IMPORT, [
        'apps/mobile/src/modules/onboarding/screens/AsbImportBackupScreen/useAsbImportBackupScreen.ts',
        'apps/mobile/src/modules/onboarding/screens/AsbImportKeyScreen/useAsbImportKeyScreen.ts',
        'apps/mobile/src/modules/onboarding/screens/AsbImportSelectAccountsScreen/useAsbImportSelectAccountsScreen.ts',
        'apps/mobile/src/modules/onboarding/screens/ImportAccountOptionsScreen/useImportAccountOptionsScreen.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportAccountScreen/useImportAccountScreen.tsx',
        'apps/mobile/src/modules/onboarding/screens/ImportSelectAddressesScreen/useImportSelectAddressesScreen.ts',
        'apps/mobile/src/modules/onboarding/screens/PeraWebImportLoadingScreen/usePeraWebImportLoadingScreen.ts',
        'apps/mobile/src/modules/onboarding/screens/SearchAccountsScreen/useSearchAccountsScreen.ts',
    ]),
    ...entries(APPLICATIONS, [
        'apps/mobile/src/modules/projects/components/ApplicationDisplay/ApplicationDisplay.tsx',
    ]),
    ...entries(DEV_FIXTURES, [
        'apps/mobile/src/modules/settings/screens/developer/SettingsDeveloperScreen/SettingsDeveloperScreen.tsx',
        'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/module-components.catalog.tsx',
        'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/screens.catalog.ts',
        'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/shared-components.catalog.tsx',
        'apps/mobile/src/modules/settings/screens/developer/gallery-catalog/sheets.catalog.tsx',
    ]),
    ...entries(ARBITRARY_DATA, [
        'apps/mobile/src/modules/signing/components/ArbitraryDataSigningView/ArbitraryDataSigningDetailsView.tsx',
        'apps/mobile/src/modules/signing/components/MultipleArbitrarySignRequestView/MultipleArbitrarySignRequestView.tsx',
        'apps/mobile/src/modules/signing/components/SingleArbitrarySignRequestView/SingleArbitrarySignRequestView.tsx',
        'apps/mobile/src/modules/signing/screens/ArbitraryDataSigningScreen/useArbitraryDataSigningScreen.ts',
        'apps/mobile/src/modules/signing/screens/Arc60SigningDetailsScreen/Arc60SigningDetailsScreen.tsx',
        'apps/mobile/src/modules/signing/screens/Arc60SigningScreen/useArc60SigningScreen.ts',
    ]),
    ...entries(STAKING, [
        'apps/mobile/src/modules/staking/components/StakingProjectCard/StakingProjectCard.tsx',
        'apps/mobile/src/modules/staking/screens/StakingScreen/useStakingScreen.tsx',
    ]),
    ...entries(WEBVIEW_BRIDGE, [
        'apps/mobile/src/modules/webview/hooks/bridge/useDataSigningHandler.ts',
        'apps/mobile/src/modules/webview/hooks/bridge/useGetAddressesHandler.ts',
        'apps/mobile/src/modules/webview/hooks/bridge/useSettingsHandlers.ts',
        'apps/mobile/src/modules/webview/hooks/bridge/useTransactionSigningHandler.ts',
        'apps/mobile/src/modules/webview/hooks/handlers-shared.ts',
        'apps/mobile/src/modules/webview/hooks/useContextFingerprints.ts',
    ]),
]
