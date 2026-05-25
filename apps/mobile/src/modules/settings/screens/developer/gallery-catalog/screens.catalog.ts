/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    MOCK_ADDRESS,
    MOCK_ADDRESS_2,
    MOCK_ASSET_ID,
    MOCK_GROUP_ID,
    MOCK_IMPORT_RESULT,
    MOCK_MULTISIG_INVITATION,
    MOCK_TX_ID,
    mockAsaInbox,
} from '@perawallet/wallet-core-dev-fixtures'

import type { GalleryEntry, GallerySection } from './types'

const rekeyFlow = (
    root: string,
    introScreen: string,
    selectScreen: string,
    confirmScreen: string,
    successScreen: string,
    label: string,
): GalleryEntry[] => [
    {
        id: `scr-${root}-intro`,
        label: `${label} · Intro`,
        launch: {
            kind: 'navigate',
            target: {
                name: root,
                params: {
                    screen: introScreen,
                    params: { sourceAddress: MOCK_ADDRESS },
                },
            },
        },
    },
    {
        id: `scr-${root}-target`,
        label: `${label} · Select target`,
        launch: {
            kind: 'navigate',
            target: {
                name: root,
                params: {
                    screen: selectScreen,
                    params: { sourceAddress: MOCK_ADDRESS },
                },
            },
        },
    },
    {
        id: `scr-${root}-confirm`,
        label: `${label} · Confirm`,
        launch: {
            kind: 'navigate',
            target: {
                name: root,
                params: {
                    screen: confirmScreen,
                    params: {
                        sourceAddress: MOCK_ADDRESS,
                        targetAddress: MOCK_ADDRESS_2,
                    },
                },
            },
        },
    },
    {
        id: `scr-${root}-success`,
        label: `${label} · Success`,
        launch: {
            kind: 'navigate',
            target: {
                name: root,
                params: {
                    screen: successScreen,
                    params: { sourceAddress: MOCK_ADDRESS },
                },
            },
        },
    },
]

export const getScreenSections = (): GallerySection[] => [
    {
        title: 'Dashboard & tabs',
        items: [
            {
                id: 'scr-tab-home',
                label: 'Home (account details)',
                launch: {
                    kind: 'navigate',
                    target: { name: 'TabBar', params: { screen: 'Home' } },
                },
            },
            {
                id: 'scr-tab-discover',
                label: 'Discover',
                launch: {
                    kind: 'navigate',
                    target: { name: 'TabBar', params: { screen: 'Discover' } },
                },
            },
            {
                id: 'scr-tab-swap',
                label: 'Swap',
                launch: {
                    kind: 'navigate',
                    target: { name: 'TabBar', params: { screen: 'Swap' } },
                },
            },
            {
                id: 'scr-tab-fund',
                label: 'Fund',
                launch: {
                    kind: 'navigate',
                    target: { name: 'TabBar', params: { screen: 'Fund' } },
                },
            },
            {
                id: 'scr-tab-menu',
                label: 'Menu',
                launch: {
                    kind: 'navigate',
                    target: { name: 'TabBar', params: { screen: 'Menu' } },
                },
            },
        ],
    },
    {
        title: 'Accounts & assets',
        items: [
            {
                id: 'scr-asset-details',
                label: 'Asset details',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'TabBar',
                        params: {
                            screen: 'Home',
                            params: {
                                screen: 'AssetDetails',
                                params: { assetId: MOCK_ASSET_ID },
                            },
                        },
                    },
                },
            },
            {
                id: 'scr-collectible-details',
                label: 'Collectible details',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'TabBar',
                        params: {
                            screen: 'Home',
                            params: {
                                screen: 'CollectibleDetails',
                                params: { assetId: MOCK_ASSET_ID },
                            },
                        },
                    },
                },
            },
            {
                id: 'scr-remove-assets',
                label: 'Remove assets',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'TabBar',
                        params: {
                            screen: 'Home',
                            params: { screen: 'RemoveAssets' },
                        },
                    },
                },
            },
            {
                id: 'scr-staking',
                label: 'Staking',
                launch: { kind: 'navigate', target: { name: 'Staking' } },
            },
        ],
    },
    {
        title: 'Add account & import',
        items: [
            {
                id: 'scr-add-account-home',
                label: 'Add account home',
                launch: { kind: 'navigate', target: { name: 'AddAccount' } },
            },
            {
                id: 'scr-select-hd-wallet',
                label: 'Select HD wallet',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'SelectHDWallet' },
                    },
                },
            },
            {
                id: 'scr-watch-info',
                label: 'Watch account info',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'WatchInfo' },
                    },
                },
            },
            {
                id: 'scr-watch-account',
                label: 'Watch account',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'WatchAccount' },
                    },
                },
            },
            {
                id: 'scr-name-account',
                label: 'Name account',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'NameAccount' },
                    },
                },
            },
            {
                id: 'scr-import-options',
                label: 'Import options',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'ImportAccountOptions' },
                    },
                },
            },
            {
                id: 'scr-ledger-instructions',
                label: 'Ledger instructions',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'LedgerInstructions' },
                    },
                },
            },
            {
                id: 'scr-ledger-pair',
                label: 'Ledger pair',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'LedgerPair' },
                    },
                },
            },
            {
                id: 'scr-ledger-scan',
                label: 'Ledger scan',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'LedgerScan' },
                    },
                },
            },
            {
                id: 'scr-ledger-troubleshooting',
                label: 'Ledger troubleshooting',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'LedgerTroubleshooting' },
                    },
                },
            },
            {
                id: 'scr-asb-import-info',
                label: 'ASB import info',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'AsbImportInfo' },
                    },
                },
            },
            {
                id: 'scr-asb-import-backup',
                label: 'ASB import backup',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'AsbImportBackup' },
                    },
                },
            },
            {
                id: 'scr-asb-import-key',
                label: 'ASB import key',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'AsbImportKey' },
                    },
                },
            },
            {
                id: 'scr-asb-import-select',
                label: 'ASB import select accounts',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'AsbImportSelectAccounts' },
                    },
                },
            },
            {
                id: 'scr-asb-import-result',
                label: 'ASB import result',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'AsbImportResult',
                            params: MOCK_IMPORT_RESULT,
                        },
                    },
                },
            },
            {
                id: 'scr-pera-web-import-info',
                label: 'Pera Web import info',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'PeraWebImportInfo' },
                    },
                },
            },
            {
                id: 'scr-pera-web-import-loading',
                label: 'Pera Web import loading',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'PeraWebImportLoading' },
                    },
                },
            },
            {
                id: 'scr-pera-web-import-result',
                label: 'Pera Web import result',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'PeraWebImportResult',
                            params: MOCK_IMPORT_RESULT,
                        },
                    },
                },
            },
        ],
    },
    {
        title: 'Backup',
        items: [
            {
                id: 'scr-backup-info',
                label: 'Backup info',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'BackupWallet',
                        params: {
                            screen: 'BackupInfo',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-backup-write-down',
                label: 'Backup write down',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'BackupWallet',
                        params: {
                            screen: 'BackupWriteDown',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-backup-mnemonic',
                label: 'Backup mnemonic',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'BackupWallet',
                        params: {
                            screen: 'BackupMnemonic',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-backup-verification',
                label: 'Backup verification',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'BackupWallet',
                        params: {
                            screen: 'BackupVerification',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-backup-success',
                label: 'Backup success',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'BackupWallet',
                        params: { screen: 'BackupSuccess' },
                    },
                },
            },
        ],
    },
    {
        title: 'Rekey',
        items: [
            ...rekeyFlow(
                'RekeyToStandard',
                'RekeyToStandardIntro',
                'RekeyToStandardSelectTarget',
                'RekeyToStandardConfirm',
                'RekeyToStandardSuccess',
                'To standard',
            ),
            ...rekeyFlow(
                'RekeyToLedger',
                'RekeyToLedgerIntro',
                'RekeyToLedgerSelectTarget',
                'RekeyToLedgerConfirm',
                'RekeyToLedgerSuccess',
                'To ledger',
            ),
            ...rekeyFlow(
                'RekeyToShared',
                'RekeyToSharedIntro',
                'RekeyToSharedSelectTarget',
                'RekeyToSharedConfirm',
                'RekeyToSharedSuccess',
                'To shared',
            ),
            {
                id: 'scr-undo-rekey-confirm',
                label: 'Undo rekey · Confirm',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'UndoRekey',
                        params: {
                            screen: 'UndoRekeyConfirm',
                            params: { sourceAddress: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-undo-rekey-success',
                label: 'Undo rekey · Success',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'UndoRekey',
                        params: {
                            screen: 'UndoRekeySuccess',
                            params: { sourceAddress: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-rescan-rekeyed',
                label: 'Rescan rekeyed · Select',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'RescanRekeyed',
                        params: {
                            screen: 'RescanRekeyedSelect',
                            params: { sourceAddress: MOCK_ADDRESS },
                        },
                    },
                },
            },
        ],
    },
    {
        title: 'Multisig',
        items: [
            {
                id: 'scr-multisig-create',
                label: 'Create multisig',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Multisig',
                        params: { screen: 'CreateMultisig' },
                    },
                },
            },
            {
                id: 'scr-multisig-threshold',
                label: 'Set threshold',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Multisig',
                        params: { screen: 'SetThreshold' },
                    },
                },
            },
            {
                id: 'scr-multisig-name',
                label: 'Name multisig',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Multisig',
                        params: { screen: 'NameMultisig' },
                    },
                },
            },
            {
                id: 'scr-multisig-import',
                label: 'Import shared account',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Multisig',
                        params: {
                            screen: 'ImportSharedAccount',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
        ],
    },
    {
        title: 'Messages & inbox',
        items: [
            {
                id: 'scr-messages-home',
                label: 'Messages home',
                launch: { kind: 'navigate', target: { name: 'Messages' } },
            },
            {
                id: 'scr-asset-claim-detail',
                label: 'Asset claim detail',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Messages',
                        params: {
                            screen: 'AssetClaimDetail',
                            params: { assetIndex: Number(MOCK_ASSET_ID) },
                        },
                    },
                },
            },
            {
                id: 'scr-claim-processing',
                label: 'Claim processing',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Messages',
                        params: {
                            screen: 'ClaimProcessing',
                            params: {
                                mode: 'claimArc59',
                                assetIndex: Number(MOCK_ASSET_ID),
                                shouldClaimAlgo: false,
                            },
                        },
                    },
                },
            },
            {
                id: 'scr-claim-success',
                label: 'Claim success',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Messages',
                        params: {
                            screen: 'ClaimSuccess',
                            params: {
                                transactionId: MOCK_TX_ID,
                                variant: 'claim',
                            },
                        },
                    },
                },
            },
            {
                id: 'scr-multisig-invitation',
                label: 'Multisig invitation',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Messages',
                        params: {
                            screen: 'MultisigInvitationName',
                            params: { invitation: MOCK_MULTISIG_INVITATION },
                        },
                    },
                },
            },
            {
                id: 'scr-asset-transfer-requests',
                label: 'Asset transfer requests',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Messages',
                        params: {
                            screen: 'AssetTransferRequests',
                            params: { item: mockAsaInbox },
                        },
                    },
                },
            },
        ],
    },
    {
        title: 'Signing',
        items: [],
    },
    {
        title: 'Contacts',
        items: [
            {
                id: 'scr-contacts-list',
                label: 'Contacts list',
                launch: { kind: 'navigate', target: { name: 'Contacts' } },
            },
            {
                id: 'scr-contact-view',
                label: 'View contact',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Contacts',
                        params: { screen: 'ViewContact' },
                    },
                },
            },
            {
                id: 'scr-contact-add',
                label: 'Add contact',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Contacts',
                        params: {
                            screen: 'AddContact',
                            params: { address: MOCK_ADDRESS },
                        },
                    },
                },
            },
            {
                id: 'scr-contact-edit',
                label: 'Edit contact',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Contacts',
                        params: {
                            screen: 'EditContact',
                            params: {
                                address: MOCK_ADDRESS,
                                label: 'Mock contact',
                            },
                        },
                    },
                },
            },
        ],
    },
    {
        title: 'Transactions',
        items: [
            {
                id: 'scr-transaction-details',
                label: 'Transaction details',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'TransactionDetails',
                        params: { transactionId: MOCK_TX_ID },
                    },
                },
            },
            {
                id: 'scr-group-transaction-list',
                label: 'Group transaction list',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'GroupTransactionList',
                        params: { groupId: MOCK_GROUP_ID },
                    },
                },
            },
        ],
    },
    {
        title: 'Search & misc',
        items: [
            {
                id: 'scr-search',
                label: 'Search',
                launch: { kind: 'navigate', target: { name: 'Search' } },
            },
            {
                id: 'scr-banners-carousel',
                label: 'Banners carousel',
                launch: {
                    kind: 'navigate',
                    target: { name: 'BannersCarouselModal' },
                },
            },
        ],
    },
    {
        title: 'Settings',
        items: [
            {
                id: 'scr-settings-home',
                label: 'Settings home',
                launch: { kind: 'navigate', target: { name: 'Settings' } },
            },
            {
                id: 'scr-settings-security',
                label: 'Security',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'SecuritySettings' },
                    },
                },
            },
            {
                id: 'scr-settings-notifications',
                label: 'Notifications',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'NotificationsSettings' },
                    },
                },
            },
            {
                id: 'scr-settings-passkeys',
                label: 'Passkeys',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'PasskeysSettings' },
                    },
                },
            },
            {
                id: 'scr-settings-currency',
                label: 'Currency',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'CurrencySettings' },
                    },
                },
            },
            {
                id: 'scr-settings-theme',
                label: 'Theme',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'ThemeSettings' },
                    },
                },
            },
            {
                id: 'scr-settings-wallet-connect',
                label: 'WalletConnect sessions',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: { screen: 'WalletConnectSettings' },
                    },
                },
            },
        ],
    },
    {
        title: 'Developer',
        items: [
            {
                id: 'scr-dev-node',
                label: 'Node settings',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'NodeSettings' },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-dispenser',
                label: 'Dispenser',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'DispenserSettings' },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-feature-flags',
                label: 'Feature flags',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'FeatureFlags' },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-manage-cache',
                label: 'Manage cache',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'ManageCache' },
                        },
                    },
                },
            },
        ],
    },
]
