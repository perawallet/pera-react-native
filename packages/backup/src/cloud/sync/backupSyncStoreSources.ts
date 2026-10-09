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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import {
    applyBackupSettings,
    readBackupSettings,
    subscribeBackupSettings,
} from './backupSettingsStores'
import type { BackupSyncSources } from './types'

/** `chainId` names the chain whose account the settings item's launch account is. */
export const createBackupSyncStoreSources = (
    chainId: ChainId,
): BackupSyncSources => ({
    getNetwork: () => useNetworkStore.getState().network,
    listAccounts: () => useAccountsStore.getState().accounts,
    subscribeAccounts: listener =>
        useAccountsStore.subscribe(state => listener(state.accounts)),
    listContacts: () => useContactsStore.getState().contacts ?? [],
    subscribeContacts: listener =>
        useContactsStore.subscribe(state => listener(state.contacts ?? [])),
    getSettings: () => readBackupSettings(chainId),
    subscribeSettings: subscribeBackupSettings,
    importSettings: settings => applyBackupSettings(settings, chainId),
})
