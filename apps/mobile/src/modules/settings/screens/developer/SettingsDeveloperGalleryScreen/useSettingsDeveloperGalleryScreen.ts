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

import { useCallback, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    MOCK_ADDRESS,
    MOCK_ADDRESS_2,
    MOCK_ASSET_ID,
    MOCK_GROUP_ID,
    MOCK_IMPORT_RESULT,
    MOCK_MULTISIG_INVITATION,
    MOCK_TX_ID,
    mockArbitraryDataSignRequest,
    mockAsaInbox,
} from '@perawallet/wallet-core-dev-fixtures'

import { useBottomSheetStore } from '@modules/bottom-sheet'

import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ParamListBase } from '@react-navigation/native'

export type GalleryItem = {
    id: string
    label: string
    onPress: () => void
}

export type GallerySection = {
    title: string
    items: GalleryItem[]
}

export type UseSettingsDeveloperGalleryScreenResult = {
    sections: GallerySection[]
    searchQuery: string
    onSearchChange: (query: string) => void
}

export const useSettingsDeveloperGalleryScreen =
    (): UseSettingsDeveloperGalleryScreenResult => {
        const navigation =
            useNavigation<NativeStackNavigationProp<ParamListBase>>()
        const accounts = useAllAccounts()
        const requestByType = useBottomSheetStore(state => state.requestByType)
        const { addSignRequest } = useSigningRequest()

        // Use a real account where one exists so address-driven screens render
        // with live data; fall back to a fixture for an empty wallet.
        const address = accounts[0]?.address ?? MOCK_ADDRESS
        const targetAddress = accounts[1]?.address ?? MOCK_ADDRESS_2

        const go = useCallback(
            (name: string, params?: object) => {
                navigation.navigate(name, params)
            },
            [navigation],
        )

        const [searchQuery, setSearchQuery] = useState('')

        const allSections = useMemo<GallerySection[]>(() => {
            const rekeyFlow = (
                root: string,
                introScreen: string,
                selectScreen: string,
                confirmScreen: string,
                successScreen: string,
                label: string,
            ): GalleryItem[] => [
                {
                    id: `${root}-intro`,
                    label: `${label} · Intro`,
                    onPress: () =>
                        go(root, {
                            screen: introScreen,
                            params: { sourceAddress: address },
                        }),
                },
                {
                    id: `${root}-target`,
                    label: `${label} · Select target`,
                    onPress: () =>
                        go(root, {
                            screen: selectScreen,
                            params: { sourceAddress: address },
                        }),
                },
                {
                    id: `${root}-confirm`,
                    label: `${label} · Confirm`,
                    onPress: () =>
                        go(root, {
                            screen: confirmScreen,
                            params: { sourceAddress: address, targetAddress },
                        }),
                },
                {
                    id: `${root}-success`,
                    label: `${label} · Success`,
                    onPress: () =>
                        go(root, {
                            screen: successScreen,
                            params: { sourceAddress: address },
                        }),
                },
            ]

            return [
                {
                    title: 'Bottom sheets',
                    items: [
                        {
                            id: 'sheet-account-actions',
                            label: 'Account actions',
                            onPress: () =>
                                void requestByType(
                                    'account-actions',
                                    { address },
                                    { enablePanDownToClose: true },
                                ),
                        },
                        {
                            id: 'sheet-asset-opt-in',
                            label: 'Asset opt-in',
                            onPress: () =>
                                void requestByType(
                                    'asset-opt-in',
                                    {
                                        assetId: MOCK_ASSET_ID,
                                        accountAddress: address,
                                    },
                                    { enablePanDownToClose: true },
                                ),
                        },
                        {
                            id: 'sheet-send-funds',
                            label: 'Send funds',
                            onPress: () =>
                                void requestByType(
                                    'send-funds',
                                    {},
                                    {
                                        size: 'lg',
                                        enablePanDownToClose: true,
                                        autoCreateContainer: false,
                                    },
                                ),
                        },
                        {
                            id: 'sheet-bidali',
                            label: 'Bidali gift cards',
                            onPress: () =>
                                void requestByType(
                                    'bidali',
                                    {},
                                    {
                                        size: 'lg',
                                        enablePanDownToClose: true,
                                        autoCreateContainer: false,
                                    },
                                ),
                        },
                    ],
                },
                {
                    title: 'Dashboard & tabs',
                    items: [
                        {
                            id: 'tab-home',
                            label: 'Home (account details)',
                            onPress: () => go('TabBar', { screen: 'Home' }),
                        },
                        {
                            id: 'tab-discover',
                            label: 'Discover',
                            onPress: () => go('TabBar', { screen: 'Discover' }),
                        },
                        {
                            id: 'tab-swap',
                            label: 'Swap',
                            onPress: () => go('TabBar', { screen: 'Swap' }),
                        },
                        {
                            id: 'tab-fund',
                            label: 'Fund',
                            onPress: () => go('TabBar', { screen: 'Fund' }),
                        },
                        {
                            id: 'tab-menu',
                            label: 'Menu',
                            onPress: () => go('TabBar', { screen: 'Menu' }),
                        },
                    ],
                },
                {
                    title: 'Accounts & assets',
                    items: [
                        {
                            id: 'asset-details',
                            label: 'Asset details',
                            onPress: () =>
                                go('TabBar', {
                                    screen: 'Home',
                                    params: {
                                        screen: 'AssetDetails',
                                        params: { assetId: MOCK_ASSET_ID },
                                    },
                                }),
                        },
                        {
                            id: 'collectible-details',
                            label: 'Collectible details',
                            onPress: () =>
                                go('TabBar', {
                                    screen: 'Home',
                                    params: {
                                        screen: 'CollectibleDetails',
                                        params: { assetId: MOCK_ASSET_ID },
                                    },
                                }),
                        },
                        {
                            id: 'remove-assets',
                            label: 'Remove assets',
                            onPress: () =>
                                go('TabBar', {
                                    screen: 'Home',
                                    params: { screen: 'RemoveAssets' },
                                }),
                        },
                        {
                            id: 'staking',
                            label: 'Staking',
                            onPress: () => go('Staking'),
                        },
                    ],
                },
                {
                    title: 'Add account & import',
                    items: [
                        {
                            id: 'add-account-home',
                            label: 'Add account home',
                            onPress: () => go('AddAccount'),
                        },
                        {
                            id: 'select-hd-wallet',
                            label: 'Select HD wallet',
                            onPress: () =>
                                go('AddAccount', { screen: 'SelectHDWallet' }),
                        },
                        {
                            id: 'watch-info',
                            label: 'Watch account info',
                            onPress: () =>
                                go('AddAccount', { screen: 'WatchInfo' }),
                        },
                        {
                            id: 'watch-account',
                            label: 'Watch account',
                            onPress: () =>
                                go('AddAccount', { screen: 'WatchAccount' }),
                        },
                        {
                            id: 'name-account',
                            label: 'Name account',
                            onPress: () =>
                                go('AddAccount', { screen: 'NameAccount' }),
                        },
                        {
                            id: 'import-options',
                            label: 'Import options',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'ImportAccountOptions',
                                }),
                        },
                        {
                            id: 'ledger-instructions',
                            label: 'Ledger instructions',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'LedgerInstructions',
                                }),
                        },
                        {
                            id: 'ledger-pair',
                            label: 'Ledger pair',
                            onPress: () =>
                                go('AddAccount', { screen: 'LedgerPair' }),
                        },
                        {
                            id: 'ledger-scan',
                            label: 'Ledger scan',
                            onPress: () =>
                                go('AddAccount', { screen: 'LedgerScan' }),
                        },
                        {
                            id: 'ledger-troubleshooting',
                            label: 'Ledger troubleshooting',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'LedgerTroubleshooting',
                                }),
                        },
                        {
                            id: 'asb-import-info',
                            label: 'ASB import info',
                            onPress: () =>
                                go('AddAccount', { screen: 'AsbImportInfo' }),
                        },
                        {
                            id: 'asb-import-backup',
                            label: 'ASB import backup',
                            onPress: () =>
                                go('AddAccount', { screen: 'AsbImportBackup' }),
                        },
                        {
                            id: 'asb-import-key',
                            label: 'ASB import key',
                            onPress: () =>
                                go('AddAccount', { screen: 'AsbImportKey' }),
                        },
                        {
                            id: 'asb-import-select',
                            label: 'ASB import select accounts',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'AsbImportSelectAccounts',
                                }),
                        },
                        {
                            id: 'asb-import-result',
                            label: 'ASB import result',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'AsbImportResult',
                                    params: MOCK_IMPORT_RESULT,
                                }),
                        },
                        {
                            id: 'pera-web-import-info',
                            label: 'Pera Web import info',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'PeraWebImportInfo',
                                }),
                        },
                        {
                            id: 'pera-web-import-loading',
                            label: 'Pera Web import loading',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'PeraWebImportLoading',
                                }),
                        },
                        {
                            id: 'pera-web-import-result',
                            label: 'Pera Web import result',
                            onPress: () =>
                                go('AddAccount', {
                                    screen: 'PeraWebImportResult',
                                    params: MOCK_IMPORT_RESULT,
                                }),
                        },
                    ],
                },
                {
                    title: 'Backup',
                    items: [
                        {
                            id: 'backup-info',
                            label: 'Backup info',
                            onPress: () =>
                                go('BackupWallet', {
                                    screen: 'BackupInfo',
                                    params: { address },
                                }),
                        },
                        {
                            id: 'backup-write-down',
                            label: 'Backup write down',
                            onPress: () =>
                                go('BackupWallet', {
                                    screen: 'BackupWriteDown',
                                    params: { address },
                                }),
                        },
                        {
                            id: 'backup-mnemonic',
                            label: 'Backup mnemonic',
                            onPress: () =>
                                go('BackupWallet', {
                                    screen: 'BackupMnemonic',
                                    params: { address },
                                }),
                        },
                        {
                            id: 'backup-verification',
                            label: 'Backup verification',
                            onPress: () =>
                                go('BackupWallet', {
                                    screen: 'BackupVerification',
                                    params: { address },
                                }),
                        },
                        {
                            id: 'backup-success',
                            label: 'Backup success',
                            onPress: () =>
                                go('BackupWallet', { screen: 'BackupSuccess' }),
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
                            id: 'undo-rekey-confirm',
                            label: 'Undo rekey · Confirm',
                            onPress: () =>
                                go('UndoRekey', {
                                    screen: 'UndoRekeyConfirm',
                                    params: { sourceAddress: address },
                                }),
                        },
                        {
                            id: 'undo-rekey-success',
                            label: 'Undo rekey · Success',
                            onPress: () =>
                                go('UndoRekey', {
                                    screen: 'UndoRekeySuccess',
                                    params: { sourceAddress: address },
                                }),
                        },
                        {
                            id: 'rescan-rekeyed',
                            label: 'Rescan rekeyed · Select',
                            onPress: () =>
                                go('RescanRekeyed', {
                                    screen: 'RescanRekeyedSelect',
                                    params: { sourceAddress: address },
                                }),
                        },
                    ],
                },
                {
                    title: 'Multisig',
                    items: [
                        {
                            id: 'multisig-create',
                            label: 'Create multisig',
                            onPress: () =>
                                go('Multisig', { screen: 'CreateMultisig' }),
                        },
                        {
                            id: 'multisig-threshold',
                            label: 'Set threshold',
                            onPress: () =>
                                go('Multisig', { screen: 'SetThreshold' }),
                        },
                        {
                            id: 'multisig-name',
                            label: 'Name multisig',
                            onPress: () =>
                                go('Multisig', { screen: 'NameMultisig' }),
                        },
                        {
                            id: 'multisig-import',
                            label: 'Import shared account',
                            onPress: () =>
                                go('Multisig', {
                                    screen: 'ImportSharedAccount',
                                    params: { address },
                                }),
                        },
                    ],
                },
                {
                    title: 'Messages & inbox',
                    items: [
                        {
                            id: 'messages-home',
                            label: 'Messages home',
                            onPress: () => go('Messages'),
                        },
                        {
                            id: 'asset-claim-detail',
                            label: 'Asset claim detail',
                            onPress: () =>
                                go('Messages', {
                                    screen: 'AssetClaimDetail',
                                    params: {
                                        assetIndex: Number(MOCK_ASSET_ID),
                                    },
                                }),
                        },
                        {
                            id: 'claim-processing',
                            label: 'Claim processing',
                            onPress: () =>
                                go('Messages', {
                                    screen: 'ClaimProcessing',
                                    params: {
                                        mode: 'claimArc59',
                                        assetIndex: Number(MOCK_ASSET_ID),
                                        shouldClaimAlgo: false,
                                    },
                                }),
                        },
                        {
                            id: 'claim-success',
                            label: 'Claim success',
                            onPress: () =>
                                go('Messages', {
                                    screen: 'ClaimSuccess',
                                    params: {
                                        transactionId: MOCK_TX_ID,
                                        variant: 'claim',
                                    },
                                }),
                        },
                        {
                            id: 'multisig-invitation',
                            label: 'Multisig invitation',
                            onPress: () =>
                                go('Messages', {
                                    screen: 'MultisigInvitationName',
                                    params: {
                                        invitation: MOCK_MULTISIG_INVITATION,
                                    },
                                }),
                        },
                        {
                            id: 'asset-transfer-requests',
                            label: 'Asset transfer requests',
                            onPress: () =>
                                go('Messages', {
                                    screen: 'AssetTransferRequests',
                                    params: { item: mockAsaInbox },
                                }),
                        },
                    ],
                },
                {
                    title: 'Signing',
                    items: [
                        {
                            id: 'arbitrary-data-signing',
                            label: 'Arbitrary data signing',
                            onPress: () => {
                                addSignRequest(mockArbitraryDataSignRequest)
                            },
                        },
                    ],
                },
                {
                    title: 'Contacts',
                    items: [
                        {
                            id: 'contacts-list',
                            label: 'Contacts list',
                            onPress: () => go('Contacts'),
                        },
                        {
                            id: 'contact-view',
                            label: 'View contact',
                            onPress: () =>
                                go('Contacts', { screen: 'ViewContact' }),
                        },
                        {
                            id: 'contact-add',
                            label: 'Add contact',
                            onPress: () =>
                                go('Contacts', {
                                    screen: 'AddContact',
                                    params: { address },
                                }),
                        },
                        {
                            id: 'contact-edit',
                            label: 'Edit contact',
                            onPress: () =>
                                go('Contacts', {
                                    screen: 'EditContact',
                                    params: { address, label: 'Mock contact' },
                                }),
                        },
                    ],
                },
                {
                    title: 'Transactions',
                    items: [
                        {
                            id: 'transaction-details',
                            label: 'Transaction details',
                            onPress: () =>
                                go('TransactionDetails', {
                                    transactionId: MOCK_TX_ID,
                                }),
                        },
                        {
                            id: 'group-transaction-list',
                            label: 'Group transaction list',
                            onPress: () =>
                                go('GroupTransactionList', {
                                    groupId: MOCK_GROUP_ID,
                                }),
                        },
                    ],
                },
                {
                    title: 'Search & misc',
                    items: [
                        {
                            id: 'search',
                            label: 'Search',
                            onPress: () => go('Search'),
                        },
                        {
                            id: 'banners-carousel',
                            label: 'Banners carousel',
                            onPress: () => go('BannersCarouselModal'),
                        },
                    ],
                },
                {
                    title: 'Settings',
                    items: [
                        {
                            id: 'settings-home',
                            label: 'Settings home',
                            onPress: () => go('Settings'),
                        },
                        {
                            id: 'settings-security',
                            label: 'Security',
                            onPress: () =>
                                go('Settings', { screen: 'SecuritySettings' }),
                        },
                        {
                            id: 'settings-notifications',
                            label: 'Notifications',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'NotificationsSettings',
                                }),
                        },
                        {
                            id: 'settings-passkeys',
                            label: 'Passkeys',
                            onPress: () =>
                                go('Settings', { screen: 'PasskeysSettings' }),
                        },
                        {
                            id: 'settings-currency',
                            label: 'Currency',
                            onPress: () =>
                                go('Settings', { screen: 'CurrencySettings' }),
                        },
                        {
                            id: 'settings-theme',
                            label: 'Theme',
                            onPress: () =>
                                go('Settings', { screen: 'ThemeSettings' }),
                        },
                        {
                            id: 'settings-wallet-connect',
                            label: 'WalletConnect sessions',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'WalletConnectSettings',
                                }),
                        },
                    ],
                },
                {
                    title: 'Developer',
                    items: [
                        {
                            id: 'dev-node',
                            label: 'Node settings',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'DeveloperSettings',
                                    params: { screen: 'NodeSettings' },
                                }),
                        },
                        {
                            id: 'dev-dispenser',
                            label: 'Dispenser',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'DeveloperSettings',
                                    params: { screen: 'DispenserSettings' },
                                }),
                        },
                        {
                            id: 'dev-feature-flags',
                            label: 'Feature flags',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'DeveloperSettings',
                                    params: { screen: 'FeatureFlags' },
                                }),
                        },
                        {
                            id: 'dev-manage-cache',
                            label: 'Manage cache',
                            onPress: () =>
                                go('Settings', {
                                    screen: 'DeveloperSettings',
                                    params: { screen: 'ManageCache' },
                                }),
                        },
                    ],
                },
            ]
        }, [go, requestByType, addSignRequest, address, targetAddress])

        // Filter by page name (item label); drop sections left with no matches.
        const sections = useMemo<GallerySection[]>(() => {
            const query = searchQuery.trim().toLowerCase()
            if (!query) return allSections

            return allSections
                .map(section => ({
                    ...section,
                    items: section.items.filter(item =>
                        item.label.toLowerCase().includes(query),
                    ),
                }))
                .filter(section => section.items.length > 0)
        }, [allSections, searchQuery])

        return { sections, searchQuery, onSearchChange: setSearchQuery }
    }
