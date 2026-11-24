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

// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { registerAlgorandAccountsAdapter } from '../../../__tests__/backupChainFixtures'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { createEmptySyncState, type SyncState } from '../../models'
import { useCloudBackupStore } from '../../store/store'
import { useBackupSyncStateStore } from '../../store/syncStateStore'
import {
    buildLocalItems,
    reconcile,
    serializeAccountForBackup,
} from '../../sync'
import { useIsAccountCoveredByCloudBackup } from '../useIsAccountCoveredByCloudBackup'

const BACKUP_ID = 'did:pera:covered'
const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const account = (id: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: `ADDR-${id}`, keyPairId: `kp-${id}` } },
    name: id,
})

const FIRST = account('first')
const SECOND = account('second')

/** Mirrors a successful sync: every item pushed, so every one counts as uploaded. */
const syncedState = async (
    accounts: WalletAccount[],
    backupId = BACKUP_ID,
): Promise<SyncState> => {
    const local = await buildLocalItems(accounts, item =>
        serializeAccountForBackup(item, {
            chainId: 'algorand',
            updatedAt: 5,
            hashAddress,
            resolveMnemonic: async () => 'w1 w2',
            resolveHd: async () => ({
                seedFirstDerivedAddress: 'SEEDFIRST',
                publicKeyHex: 'pk',
                seedHex: 'aa',
                entropyHex: 'bb',
            }),
        }),
    )
    const reconciled = reconcile(createEmptySyncState(backupId), local, 1)
    return {
        ...reconciled,
        lastSyncResult: 'SUCCESS',
        items: Object.fromEntries(
            Object.entries(reconciled.items).map(([key, item]) => [
                key,
                { ...item, knownVer: 1, baseVer: 1, isDirty: false },
            ]),
        ),
    }
}

const configure = (credentialsConfirmed: boolean, backupId = BACKUP_ID) =>
    act(() =>
        useCloudBackupStore.getState().setConfigured({
            backupId,
            salt: 'c2FsdA==',
            deviceId: 'device-1',
            credentialsConfirmed,
        }),
    )

const setSyncState = (state: SyncState) =>
    act(() => useBackupSyncStateStore.getState().setSyncState(state))

const renderCovered = (target: Maybe<WalletAccount>) =>
    renderHook(() => useIsAccountCoveredByCloudBackup(target))

describe('useIsAccountCoveredByCloudBackup', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        registerAlgorandAccountsAdapter()
        act(() => {
            useCloudBackupStore.getState().resetState()
            useBackupSyncStateStore.getState().resetState()
        })
    })

    test('true when a confirmed backup holds the account in its latest sync', async () => {
        configure(true)
        setSyncState(await syncedState([FIRST]))

        expect(renderCovered(FIRST).result.current).toBe(true)
    })

    test('false while the credentials are unconfirmed, all else equal', async () => {
        configure(false)
        setSyncState(await syncedState([FIRST]))

        expect(renderCovered(FIRST).result.current).toBe(false)
    })

    test('false once Cloud Backup is turned off or deleted', async () => {
        configure(true)
        setSyncState(await syncedState([FIRST]))
        const { result } = renderCovered(FIRST)
        expect(result.current).toBe(true)

        act(() => {
            useCloudBackupStore.getState().resetState()
            useBackupSyncStateStore.getState().resetState()
        })

        expect(result.current).toBe(false)
    })

    test('false when the sync state belongs to another backup', async () => {
        configure(true)
        setSyncState(await syncedState([FIRST], 'did:pera:other'))

        expect(renderCovered(FIRST).result.current).toBe(false)
    })

    test('false after a failed sync, true again after the next success', async () => {
        configure(true)
        const state = await syncedState([FIRST])
        setSyncState(state)
        const { result } = renderCovered(FIRST)
        expect(result.current).toBe(true)

        setSyncState({ ...state, lastSyncResult: 'FAILED' })
        expect(result.current).toBe(false)

        setSyncState(state)
        expect(result.current).toBe(true)
    })

    test('clears only after the first success once the backup is turned back on', async () => {
        const { result } = renderCovered(FIRST)

        configure(true)
        setSyncState(createEmptySyncState(BACKUP_ID))
        expect(result.current).toBe(false)

        setSyncState(await syncedState([FIRST]))
        expect(result.current).toBe(true)
    })

    test('covers only the accounts in the latest sync', async () => {
        configure(true)
        setSyncState(await syncedState([FIRST]))

        expect(renderCovered(FIRST).result.current).toBe(true)
        expect(renderCovered(SECOND).result.current).toBe(false)
    })

    test('false without an account', async () => {
        configure(true)
        setSyncState(await syncedState([FIRST]))

        expect(renderCovered(undefined).result.current).toBe(false)
    })
})
