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
import {
    createEmptySyncState,
    type SyncItemState,
    type SyncState,
} from '../syncState'
import { BackupItemStatus, BackupItemType } from '../types'
import { deriveBackupAccountReview, isAddressBackedUp } from '../reviewBuckets'

const tracked = (overrides: Partial<SyncItemState> = {}): SyncItemState => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 1,
    baseVer: 1,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: 'r',
    localContentHash: 'h',
    localUpdatedAt: null,
    ...overrides,
})

describe('deriveBackupAccountReview', () => {
    it('reports every local account as not backed up without a sync state', () => {
        const review = deriveBackupAccountReview(null, ['A', 'B'])
        expect(review.notBackedUp).toEqual(['A', 'B'])
        expect(review.backedUp.size).toBe(0)
        expect(review.availableFromBackup).toEqual([])
    })

    it('splits local accounts by whether the backup holds them', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked()
        state.items['accounts/B'] = tracked({
            status: BackupItemStatus.IGNORED,
        })

        const review = deriveBackupAccountReview(state, ['A', 'B'])
        expect([...review.backedUp]).toEqual(['A'])
        expect(review.notBackedUp).toEqual(['B'])
    })

    it('counts a pending delete as not backed up', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked({ pendingDelete: true })

        expect(deriveBackupAccountReview(state, ['A']).notBackedUp).toEqual([
            'A',
        ])
    })

    it('counts an account the server has never seen as not backed up', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked({ knownVer: 0, isDirty: true })

        const review = deriveBackupAccountReview(state, ['A'])
        expect(review.notBackedUp).toEqual(['A'])
        expect(review.backedUp.size).toBe(0)
    })

    it('surfaces a reviewed address the device does not hold', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/GONE'] = tracked({ pendingImport: true })

        const review = deriveBackupAccountReview(state, ['A'])
        expect(review.availableFromBackup).toEqual(['GONE'])
        expect(review.notBackedUp).toEqual(['A'])
    })

    it('drops a reviewed address once the device holds it again', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked({ pendingImport: true })

        const review = deriveBackupAccountReview(state, ['A'])
        expect(review.availableFromBackup).toEqual([])
    })

    it('ignores secrets keys so a secret-bearing account is counted once', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked()
        state.items['secrets/A'] = tracked()

        expect([...deriveBackupAccountReview(state, ['A']).backedUp]).toEqual([
            'A',
        ])
    })
})

describe('isAddressBackedUp', () => {
    it('agrees with the backedUp bucket for an account the backup holds', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked()

        expect(isAddressBackedUp(state, 'A')).toBe(true)
        expect(isAddressBackedUp(state, 'B')).toBe(false)
        expect(isAddressBackedUp(null, 'A')).toBe(false)
    })

    it('agrees with the backedUp bucket for an account awaiting review', () => {
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = tracked({ pendingImport: true })

        expect(isAddressBackedUp(state, 'A')).toBe(false)
        expect(deriveBackupAccountReview(state, ['A']).backedUp.size).toBe(0)
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

/** Mirrors a successful push: `pushDirty` advances every accepted item's
 *  version off 0, which is what makes it count as uploaded. */
const markUploaded = (state: SyncState): SyncState => ({
    ...state,
    items: Object.fromEntries(
        Object.entries(state.items).map(([key, item]) => [
            key,
            { ...item, knownVer: 1, baseVer: 1, isDirty: false },
        ]),
    ),
})

const backedUpAfterSync = async (
    accounts: WalletAccount[],
    { uploaded = true }: { uploaded?: boolean } = {},
) => {
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
    const reconciled = reconcile(createEmptySyncState('did:pera:x'), local, 1)
    return deriveBackupAccountReview(
        uploaded ? markUploaded(reconciled) : reconciled,
        accounts.map(account => account.address),
    ).backedUp
}

describe('deriveBackupAccountReview over a real reconciled snapshot', () => {
    it('reports one account for a single algo25 account', async () => {
        expect((await backedUpAfterSync([algo25])).size).toBe(1)
    })

    it('reports one account for a single HD account, whose seed is its own item', async () => {
        expect((await backedUpAfterSync([hdChild('HD1', 0)])).size).toBe(1)
    })

    it('reports every HD child once even though they share one seed item', async () => {
        expect(
            (await backedUpAfterSync([hdChild('HD1', 0), hdChild('HD2', 1)]))
                .size,
        ).toBe(2)
    })

    it('reports nothing until the first upload lands', async () => {
        expect(
            (await backedUpAfterSync([algo25], { uploaded: false })).size,
        ).toBe(0)
    })
})
