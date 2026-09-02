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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    buildLocalItems,
    reconcile,
    serializeAccountForBackup,
} from '../../sync'
import { createEmptySyncState, type SyncItemState } from '../syncState'
import { deriveBackupSyncCounts } from '../syncCounts'
import { BackupItemStatus, BackupItemType } from '../types'

const item = (over: Partial<SyncItemState>): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'h',
    ...over,
})

const stateWith = (items: Record<string, SyncItemState>) => ({
    ...createEmptySyncState('did:pera:x'),
    items,
})

describe('deriveBackupSyncCounts', () => {
    it('returns zeroes when there is no sync state yet', () => {
        expect(deriveBackupSyncCounts(null)).toEqual({
            accountsInSync: 0,
            contactsInSync: 0,
        })
    })

    it('counts an address record once and never its secrets twin', () => {
        const counts = deriveBackupSyncCounts(
            stateWith({
                'accounts/A': item({}),
                'secrets/A': item({}),
            }),
        )

        expect(counts.accountsInSync).toBe(1)
    })

    it('excludes IGNORED and locally deleted records', () => {
        const counts = deriveBackupSyncCounts(
            stateWith({
                'accounts/A': item({}),
                'accounts/B': item({ status: BackupItemStatus.IGNORED }),
                'accounts/C': item({ pendingDelete: true }),
            }),
        )

        expect(counts.accountsInSync).toBe(1)
    })

    it('counts dirty records, which are backed up but have unpushed edits', () => {
        const counts = deriveBackupSyncCounts(
            stateWith({ 'accounts/A': item({ isDirty: true }) }),
        )

        expect(counts.accountsInSync).toBe(1)
    })

    it('counts contacts separately from accounts', () => {
        const counts = deriveBackupSyncCounts(
            stateWith({
                'accounts/A': item({}),
                'contacts/C': item({ type: BackupItemType.CONTACT }),
            }),
        )

        expect(counts).toEqual({ accountsInSync: 1, contactsInSync: 1 })
    })
})

const algo25 = {
    id: '1',
    type: AccountTypes.algo25,
    address: 'ADDR',
    keyPairId: 'kp-1',
    name: 'Main',
} as WalletAccount

const hdChild = (address: string, keyIndex: number) =>
    ({
        id: address,
        type: AccountTypes.hdWallet,
        address,
        keyPairId: `kp-${address}`,
        name: address,
        hdWalletDetails: { account: 0, change: 0, keyIndex, derivationType: 9 },
    }) as WalletAccount

const countAfterSync = async (accounts: WalletAccount[]) => {
    const local = await buildLocalItems(accounts, account =>
        serializeAccountForBackup(account, {
            updatedAt: 5,
            resolveMnemonic: async () => 'w1 w2',
            resolveHd: async () => ({
                seedFirstDerivedAddress: 'SEEDFIRST',
                publicKeyHex: 'pk',
                seedHex: 'aa',
                entropyHex: 'bb',
            }),
        }),
    )
    return deriveBackupSyncCounts(
        reconcile(createEmptySyncState('did:pera:x'), local, 1),
    )
}

describe('deriveBackupSyncCounts over a real reconciled snapshot', () => {
    it('reports one account for a single algo25 account', async () => {
        expect((await countAfterSync([algo25])).accountsInSync).toBe(1)
    })

    it('reports one account for a single HD account, whose seed is its own item', async () => {
        expect((await countAfterSync([hdChild('HD1', 0)])).accountsInSync).toBe(
            1,
        )
    })

    it('reports every HD child once even though they share one seed item', async () => {
        expect(
            (await countAfterSync([hdChild('HD1', 0), hdChild('HD2', 1)]))
                .accountsInSync,
        ).toBe(2)
    })
})
