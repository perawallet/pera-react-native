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
                id: 'scr-account-details',
                label: 'Account details (Home)',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'TabBar',
                        params: {
                            screen: 'Home',
                            params: { screen: 'AccountDetails' },
                        },
                    },
                },
            },
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
        title: 'Onboarding',
        items: [
            // Unreachable from a logged-in session (the gallery lives there):
            // the Onboarding stack only mounts before the first account exists.
            {
                id: 'scr-onboarding-home',
                label: 'Onboarding welcome (needs onboarding state)',
                launch: { kind: 'action', run: () => undefined },
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
                id: 'scr-import-info',
                label: 'Import info',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'ImportInfo',
                            params: { accountType: 'algo25' },
                        },
                    },
                },
            },
            {
                id: 'scr-import-account',
                label: 'Import account',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'ImportAccount',
                            params: { accountType: 'algo25' },
                        },
                    },
                },
            },
            {
                id: 'scr-search-accounts',
                label: 'Search accounts',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: { screen: 'SearchAccounts' },
                    },
                },
            },
            {
                id: 'scr-import-select-addresses',
                label: 'Import select addresses',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'ImportSelectAddresses',
                            params: { accounts: [] },
                        },
                    },
                },
            },
            {
                id: 'scr-import-rekeyed-addresses',
                label: 'Import rekeyed addresses',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'AddAccount',
                        params: {
                            screen: 'ImportRekeyedAddresses',
                            params: { accounts: [] },
                        },
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
                id: 'scr-ledger-fetch-accounts',
                label: 'Ledger fetch accounts (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-ledger-select-accounts',
                label: 'Ledger select accounts (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-ledger-verify',
                label: 'Ledger verify (needs live state)',
                launch: { kind: 'action', run: () => undefined },
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
            ...rekeyFlow(
                'RekeyToQuantum',
                'RekeyToQuantumIntro',
                'RekeyToQuantumSelectTarget',
                'RekeyToQuantumConfirm',
                'RekeyToQuantumSuccess',
                'To quantum',
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
            {
                id: 'scr-multisig-edit-participant',
                label: 'Edit participant',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Multisig',
                        params: {
                            screen: 'EditParticipant',
                            params: { index: 0, address: MOCK_ADDRESS },
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
        items: [
            {
                id: 'scr-signing-single-transaction',
                label: 'Single transaction (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-transaction-list',
                label: 'Transaction list (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-group-detail',
                label: 'Group detail (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-transaction-details',
                label: 'Signing transaction details (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-arbitrary-data',
                label: 'Arbitrary data signing (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-arbitrary-data-details',
                label: 'Arbitrary data signing details (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-arc60',
                label: 'ARC-60 signing (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-signing-arc60-details',
                label: 'ARC-60 signing details (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
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
        title: 'Send funds',
        items: [
            {
                id: 'scr-send-asset-selection',
                label: 'Send · Asset selection (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-input-amount',
                label: 'Send · Input amount (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-select-destination',
                label: 'Send · Select destination (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-confirm-transaction',
                label: 'Send · Confirm transaction (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-express-send',
                label: 'Send · Express send (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-arc59-summary',
                label: 'Send · ARC-59 send summary (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-insufficient-balance',
                label: 'Send · Insufficient balance (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-processing',
                label: 'Send · Transaction processing (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-send-success',
                label: 'Send · Transaction success (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Receive funds',
        items: [
            {
                id: 'scr-receive-account-selection',
                label: 'Receive · Account selection (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-receive-qr-view',
                label: 'Receive · QR view (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Gift card (Bidali)',
        items: [
            {
                id: 'scr-bidali-intro',
                label: 'Bidali intro (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-bidali-account-selection',
                label: 'Bidali account selection (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'scr-bidali-webview',
                label: 'Bidali web view (needs live state)',
                launch: { kind: 'action', run: () => undefined },
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
            {
                id: 'scr-settings-wallet-connect-details',
                label: 'WalletConnect session details (needs live state)',
                launch: { kind: 'action', run: () => undefined },
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
            {
                id: 'scr-dev-menu',
                label: 'Developer menu',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'DevMenu' },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-gallery',
                label: 'Gallery',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: { screen: 'Gallery' },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-gallery-category',
                label: 'Gallery category',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: {
                                screen: 'GalleryCategory',
                                params: { categoryId: 'screens' },
                            },
                        },
                    },
                },
            },
            {
                id: 'scr-dev-gallery-preview',
                label: 'Gallery preview',
                launch: {
                    kind: 'navigate',
                    target: {
                        name: 'Settings',
                        params: {
                            screen: 'DeveloperSettings',
                            params: {
                                screen: 'GalleryPreview',
                                params: { entryId: 'scr-tab-home' },
                            },
                        },
                    },
                },
            },
        ],
    },
]
