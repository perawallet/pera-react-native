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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBackfillEntropyKeyId } from '../useBackfillEntropyKeyId'
import { useAccountsStore } from '../../store'
import { AccountTypes, type HDWalletAccount } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...actual,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const buildHdAccount = (
    overrides: Partial<{
        id: string
        address: string
        keyPairId: string
        entropyKeyId: string
        keyIndex: number
        account: number
    }>,
): HDWalletAccount => ({
    id: overrides.id ?? 'acc',
    address: overrides.address ?? 'ADDR',
    type: AccountTypes.hdWallet,
    keyPairId: overrides.keyPairId ?? 'WALLET1',
    entropyKeyId: overrides.entropyKeyId,
    hdWalletDetails: {
        account: overrides.account ?? 0,
        change: 0,
        keyIndex: overrides.keyIndex ?? 0,
        derivationType: 9,
        keystoreKeyId: 'ks-derived',
    },
})

const asHd = (acc: unknown): HDWalletAccount => acc as HDWalletAccount

describe('useBackfillEntropyKeyId', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('copies entropyKeyId from a sibling onto siblings missing it', () => {
        useAccountsStore.setState({
            accounts: [
                buildHdAccount({
                    id: 'a1',
                    address: 'ADDR1',
                    keyIndex: 0,
                    entropyKeyId: 'entropy-1',
                }),
                buildHdAccount({
                    id: 'a2',
                    address: 'ADDR2',
                    keyIndex: 1,
                }),
                buildHdAccount({
                    id: 'a3',
                    address: 'ADDR3',
                    keyIndex: 2,
                }),
            ] as any,
        })

        renderHook(() => useBackfillEntropyKeyId())

        const accounts = useAccountsStore.getState().accounts
        expect(asHd(accounts[0]).entropyKeyId).toBe('entropy-1')
        expect(asHd(accounts[1]).entropyKeyId).toBe('entropy-1')
        expect(asHd(accounts[2]).entropyKeyId).toBe('entropy-1')
    })

    test('only backfills within the same wallet group', () => {
        useAccountsStore.setState({
            accounts: [
                buildHdAccount({
                    id: 'a1',
                    address: 'ADDR1',
                    keyPairId: 'WALLET_A',
                    entropyKeyId: 'entropy-A',
                }),
                buildHdAccount({
                    id: 'a2',
                    address: 'ADDR2',
                    keyPairId: 'WALLET_B',
                }),
            ] as any,
        })

        renderHook(() => useBackfillEntropyKeyId())

        const accounts = useAccountsStore.getState().accounts
        expect(asHd(accounts[0]).entropyKeyId).toBe('entropy-A')
        expect(asHd(accounts[1]).entropyKeyId).toBeUndefined()
    })

    test('does nothing when no sibling has entropyKeyId set', () => {
        useAccountsStore.setState({
            accounts: [
                buildHdAccount({ id: 'a1', address: 'ADDR1' }),
                buildHdAccount({ id: 'a2', address: 'ADDR2', keyIndex: 1 }),
            ] as any,
        })

        const before = useAccountsStore.getState().accounts
        renderHook(() => useBackfillEntropyKeyId())
        const after = useAccountsStore.getState().accounts

        expect(after).toBe(before)
        expect(asHd(after[0]).entropyKeyId).toBeUndefined()
        expect(asHd(after[1]).entropyKeyId).toBeUndefined()
    })

    test('is a no-op when accounts is empty', () => {
        const before = useAccountsStore.getState().accounts
        renderHook(() => useBackfillEntropyKeyId())
        expect(useAccountsStore.getState().accounts).toBe(before)
    })

    test('is a no-op when all HD accounts already have entropyKeyId', () => {
        useAccountsStore.setState({
            accounts: [
                buildHdAccount({
                    id: 'a1',
                    address: 'ADDR1',
                    entropyKeyId: 'e1',
                }),
                buildHdAccount({
                    id: 'a2',
                    address: 'ADDR2',
                    keyIndex: 1,
                    entropyKeyId: 'e1',
                }),
            ] as any,
        })

        const before = useAccountsStore.getState().accounts
        renderHook(() => useBackfillEntropyKeyId())
        expect(useAccountsStore.getState().accounts).toBe(before)
    })

    test('after donor loses entropyKeyId, rerender re-backfills donor without clobbering the sibling', () => {
        useAccountsStore.setState({
            accounts: [
                buildHdAccount({
                    id: 'a1',
                    address: 'ADDR1',
                    entropyKeyId: 'entropy-1',
                }),
                buildHdAccount({
                    id: 'a2',
                    address: 'ADDR2',
                    keyIndex: 1,
                }),
            ] as any,
        })

        const { rerender } = renderHook(() => useBackfillEntropyKeyId())

        const afterFirstMount = useAccountsStore.getState().accounts
        expect(asHd(afterFirstMount[1]).entropyKeyId).toBe('entropy-1')

        // Simulate the former donor losing entropy mid-session while the
        // recipient still holds it — the effect may run again (it keys off
        // `accounts`) and must not clear the sibling; it should copy back
        // from any sibling that still carries `entropyKeyId`.
        useAccountsStore.setState({
            accounts: [
                { ...afterFirstMount[0], entropyKeyId: undefined },
                afterFirstMount[1],
            ] as any,
        })
        const beforeRerender = useAccountsStore.getState().accounts
        const siblingBefore = beforeRerender[1]

        rerender()

        const after = useAccountsStore.getState().accounts
        expect(asHd(after[1]).entropyKeyId).toBe('entropy-1')
        expect(after[1]).toBe(siblingBefore)
        expect(asHd(after[0]).entropyKeyId).toBe('entropy-1')
    })
})
