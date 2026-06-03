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

/**
 * TEMP-SCREENSHOT-TOUR — throwaway dev harness. Steps through every gallery
 * target via navigationRef and logs a `GALLERY_SHOT|nn|label` marker an
 * external screenshot loop watches in the Metro log. Remove after use.
 */

import { navigationRef } from './navigationRef'
import { useBottomSheetStore } from '@modules/bottom-sheet'
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

const A = MOCK_ADDRESS
const A2 = MOCK_ADDRESS_2

const nav = navigationRef as unknown as {
    isReady: () => boolean
    navigate: (name: string, params?: object) => void
}

const go = (name: string, params?: object) => nav.navigate(name, params)
const sheet = useBottomSheetStore.getState

type Step = { label: string; run: () => void }

const rekey = (root: string, label: string): Step[] => [
    {
        label: `${label} intro`,
        run: () =>
            go(root, { screen: `${root}Intro`, params: { sourceAddress: A } }),
    },
    {
        label: `${label} select`,
        run: () =>
            go(root, {
                screen: `${root}SelectTarget`,
                params: { sourceAddress: A },
            }),
    },
    {
        label: `${label} confirm`,
        run: () =>
            go(root, {
                screen: `${root}Confirm`,
                params: { sourceAddress: A, targetAddress: A2 },
            }),
    },
    {
        label: `${label} success`,
        run: () =>
            go(root, {
                screen: `${root}Success`,
                params: { sourceAddress: A },
            }),
    },
]

const STEPS: Step[] = [
    {
        label: 'sheet account-actions',
        run: () =>
            void sheet().requestByType(
                'account-actions',
                { address: A },
                { enablePanDownToClose: true },
            ),
    },
    {
        label: 'sheet asset-opt-in',
        run: () =>
            void sheet().requestByType(
                'asset-opt-in',
                { assetId: MOCK_ASSET_ID, accountAddress: A },
                { size: 'modal', enablePanDownToClose: true },
            ),
    },
    {
        label: 'sheet send-funds',
        run: () =>
            void sheet().requestByType(
                'send-funds',
                {},
                {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            ),
    },
    {
        label: 'sheet bidali',
        run: () =>
            void sheet().requestByType(
                'bidali',
                {},
                {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            ),
    },
    { label: 'tab home', run: () => go('TabBar', { screen: 'Home' }) },
    { label: 'tab discover', run: () => go('TabBar', { screen: 'Discover' }) },
    { label: 'tab swap', run: () => go('TabBar', { screen: 'Swap' }) },
    { label: 'tab fund', run: () => go('TabBar', { screen: 'Fund' }) },
    { label: 'tab menu', run: () => go('TabBar', { screen: 'Menu' }) },
    {
        label: 'asset details',
        run: () =>
            go('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'AssetDetails',
                    params: { assetId: MOCK_ASSET_ID },
                },
            }),
    },
    {
        label: 'collectible details',
        run: () =>
            go('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'CollectibleDetails',
                    params: { assetId: MOCK_ASSET_ID },
                },
            }),
    },
    {
        label: 'remove assets',
        run: () =>
            go('TabBar', {
                screen: 'Home',
                params: { screen: 'RemoveAssets' },
            }),
    },
    { label: 'staking', run: () => go('Staking') },
    { label: 'add account home', run: () => go('AddAccount') },
    {
        label: 'select hd wallet',
        run: () => go('AddAccount', { screen: 'SelectHDWallet' }),
    },
    {
        label: 'watch info',
        run: () => go('AddAccount', { screen: 'WatchInfo' }),
    },
    {
        label: 'watch account',
        run: () => go('AddAccount', { screen: 'WatchAccount' }),
    },
    {
        label: 'name account',
        run: () => go('AddAccount', { screen: 'NameAccount' }),
    },
    {
        label: 'import options',
        run: () => go('AddAccount', { screen: 'ImportAccountOptions' }),
    },
    {
        label: 'ledger pair',
        run: () => go('AddAccount', { screen: 'LedgerPair' }),
    },
    {
        label: 'ledger scan',
        run: () => go('AddAccount', { screen: 'LedgerScan' }),
    },
    {
        label: 'ledger instructions',
        run: () => go('AddAccount', { screen: 'LedgerInstructions' }),
    },
    {
        label: 'ledger troubleshooting',
        run: () => go('AddAccount', { screen: 'LedgerTroubleshooting' }),
    },
    {
        label: 'asb import info',
        run: () => go('AddAccount', { screen: 'AsbImportInfo' }),
    },
    {
        label: 'asb import backup',
        run: () => go('AddAccount', { screen: 'AsbImportBackup' }),
    },
    {
        label: 'asb import key',
        run: () => go('AddAccount', { screen: 'AsbImportKey' }),
    },
    {
        label: 'asb import select',
        run: () => go('AddAccount', { screen: 'AsbImportSelectAccounts' }),
    },
    {
        label: 'asb import result',
        run: () =>
            go('AddAccount', {
                screen: 'AsbImportResult',
                params: MOCK_IMPORT_RESULT,
            }),
    },
    {
        label: 'pera web import info',
        run: () => go('AddAccount', { screen: 'PeraWebImportInfo' }),
    },
    {
        label: 'pera web import loading',
        run: () => go('AddAccount', { screen: 'PeraWebImportLoading' }),
    },
    {
        label: 'pera web import result',
        run: () =>
            go('AddAccount', {
                screen: 'PeraWebImportResult',
                params: MOCK_IMPORT_RESULT,
            }),
    },
    {
        label: 'backup info',
        run: () =>
            go('BackupWallet', {
                screen: 'BackupInfo',
                params: { address: A },
            }),
    },
    {
        label: 'backup write down',
        run: () =>
            go('BackupWallet', {
                screen: 'BackupWriteDown',
                params: { address: A },
            }),
    },
    {
        label: 'backup mnemonic',
        run: () =>
            go('BackupWallet', {
                screen: 'BackupMnemonic',
                params: { address: A },
            }),
    },
    {
        label: 'backup verification',
        run: () =>
            go('BackupWallet', {
                screen: 'BackupVerification',
                params: { address: A },
            }),
    },
    {
        label: 'backup success',
        run: () => go('BackupWallet', { screen: 'BackupSuccess' }),
    },
    ...rekey('RekeyToStandard', 'rekey-standard'),
    ...rekey('RekeyToLedger', 'rekey-ledger'),
    ...rekey('RekeyToShared', 'rekey-shared'),
    {
        label: 'undo rekey confirm',
        run: () =>
            go('UndoRekey', {
                screen: 'UndoRekeyConfirm',
                params: { sourceAddress: A },
            }),
    },
    {
        label: 'undo rekey success',
        run: () =>
            go('UndoRekey', {
                screen: 'UndoRekeySuccess',
                params: { sourceAddress: A },
            }),
    },
    {
        label: 'rescan rekeyed',
        run: () =>
            go('RescanRekeyed', {
                screen: 'RescanRekeyedSelect',
                params: { sourceAddress: A },
            }),
    },
    {
        label: 'multisig create',
        run: () => go('Multisig', { screen: 'CreateMultisig' }),
    },
    {
        label: 'multisig threshold',
        run: () => go('Multisig', { screen: 'SetThreshold' }),
    },
    {
        label: 'multisig name',
        run: () => go('Multisig', { screen: 'NameMultisig' }),
    },
    {
        label: 'multisig import',
        run: () =>
            go('Multisig', {
                screen: 'ImportSharedAccount',
                params: { address: A },
            }),
    },
    { label: 'messages home', run: () => go('Messages') },
    {
        label: 'asset claim detail',
        run: () =>
            go('Messages', {
                screen: 'AssetClaimDetail',
                params: { assetIndex: Number(MOCK_ASSET_ID) },
            }),
    },
    {
        label: 'claim processing',
        run: () =>
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
        label: 'claim success',
        run: () =>
            go('Messages', {
                screen: 'ClaimSuccess',
                params: { transactionId: MOCK_TX_ID, variant: 'claim' },
            }),
    },
    {
        label: 'multisig invitation',
        run: () =>
            go('Messages', {
                screen: 'MultisigInvitationName',
                params: { invitation: MOCK_MULTISIG_INVITATION },
            }),
    },
    {
        label: 'asset transfer requests',
        run: () =>
            go('Messages', {
                screen: 'AssetTransferRequests',
                params: { item: mockAsaInbox },
            }),
    },
    { label: 'contacts list', run: () => go('Contacts') },
    {
        label: 'contact view',
        run: () => go('Contacts', { screen: 'ViewContact' }),
    },
    {
        label: 'contact add',
        run: () =>
            go('Contacts', { screen: 'AddContact', params: { address: A } }),
    },
    {
        label: 'contact edit',
        run: () =>
            go('Contacts', {
                screen: 'EditContact',
                params: { address: A, label: 'Mock contact' },
            }),
    },
    {
        label: 'transaction details',
        run: () => go('TransactionDetails', { transactionId: MOCK_TX_ID }),
    },
    {
        label: 'group transaction list',
        run: () => go('GroupTransactionList', { groupId: MOCK_GROUP_ID }),
    },
    { label: 'search', run: () => go('Search') },
    {
        label: 'banners carousel',
        run: () => go('BannersCarouselModal'),
    },
    { label: 'settings home', run: () => go('Settings') },
    {
        label: 'settings security',
        run: () => go('Settings', { screen: 'SecuritySettings' }),
    },
    {
        label: 'settings notifications',
        run: () => go('Settings', { screen: 'NotificationsSettings' }),
    },
    {
        label: 'settings passkeys',
        run: () => go('Settings', { screen: 'PasskeysSettings' }),
    },
    {
        label: 'settings currency',
        run: () => go('Settings', { screen: 'CurrencySettings' }),
    },
    {
        label: 'settings theme',
        run: () => go('Settings', { screen: 'ThemeSettings' }),
    },
    {
        label: 'settings wallet connect',
        run: () => go('Settings', { screen: 'WalletConnectSettings' }),
    },
    {
        label: 'dev node',
        run: () =>
            go('Settings', {
                screen: 'DeveloperSettings',
                params: { screen: 'NodeSettings' },
            }),
    },
    {
        label: 'dev dispenser',
        run: () =>
            go('Settings', {
                screen: 'DeveloperSettings',
                params: { screen: 'DispenserSettings' },
            }),
    },
    {
        label: 'dev feature flags',
        run: () =>
            go('Settings', {
                screen: 'DeveloperSettings',
                params: { screen: 'FeatureFlags' },
            }),
    },
    {
        label: 'dev manage cache',
        run: () =>
            go('Settings', {
                screen: 'DeveloperSettings',
                params: { screen: 'ManageCache' },
            }),
    },
]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let started = false

const goToGallery = () =>
    go('Settings', {
        screen: 'DeveloperSettings',
        params: { screen: 'Gallery' },
    })

export const runGalleryTour = async (): Promise<void> => {
    if (started || !nav.isReady()) return
    started = true

    try {
        for (let i = 0; i < STEPS.length; i++) {
            const step = STEPS[i]
            sheet().dismissAll()
            goToGallery()
            await sleep(700)
            try {
                step.run()
            } catch (error) {
                console.log(`GALLERY_ERR|${step.label}|${String(error)}`)
            }
            await sleep(1800)
            const tag = String(i).padStart(2, '0')
            console.log(`GALLERY_SHOT|${tag}|${step.label}`)
            await sleep(1800)
            sheet().dismissAll()
            await sleep(300)
        }

        sheet().dismissAll()
        goToGallery()
        console.log('GALLERY_TOUR_DONE')
    } finally {
        started = false
    }
}

export const startGalleryTour = (): void => {
    void runGalleryTour()
}
