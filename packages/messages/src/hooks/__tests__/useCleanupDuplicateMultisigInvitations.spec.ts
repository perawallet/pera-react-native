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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform/test-utils'
import {
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCleanupDuplicateMultisigInvitations } from '../useCleanupDuplicateMultisigInvitations'
import { fetchInbox } from '../../api/inbox'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(() => true),
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

vi.mock('../../api/inbox', () => ({
    fetchInbox: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

const account = (
    address: string,
    custody: WalletAccount['custody'] = { kind: 'local', seed: 'algo25' },
): WalletAccount => ({
    id: address,
    custody,
    chains: { algorand: { address, keyPairId: `key-${address}` } },
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSigningAccounts: vi.fn(),
    useAllAccounts: vi.fn(),
}))

const mutateMock = vi.fn()

vi.mock('../useDeleteMultisigInvitationMutation', () => ({
    useDeleteMultisigInvitationMutation: vi.fn(() => ({
        mutate: mutateMock,
    })),
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSigningAccounts).mockReturnValue([
        account('ADDR1'),
        account('ADDR2'),
    ])
    vi.mocked(useAllAccounts).mockReturnValue([])
})

describe('useCleanupDuplicateMultisigInvitations', () => {
    it('fires delete for each duplicate import address', async () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            account('ADDR1'),
            account('MSIG_DUP_1', { kind: 'multisig' }),
            account('MSIG_DUP_2', { kind: 'multisig' }),
        ])

        vi.mocked(fetchInbox).mockResolvedValue({
            joint_account_import_requests: [
                {
                    custom_id: 'a',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_DUP_1',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
                {
                    custom_id: 'b',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_DUP_2',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
                {
                    custom_id: 'c',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_NEW',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
            ],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        })

        renderHook(() => useCleanupDuplicateMultisigInvitations(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(mutateMock).toHaveBeenCalledTimes(2)
        })

        const calledAddresses = mutateMock.mock.calls.map(
            ([input]) => (input as { multisigAddress: string }).multisigAddress,
        )
        expect(calledAddresses).toEqual(
            expect.arrayContaining(['MSIG_DUP_1', 'MSIG_DUP_2']),
        )
        expect(calledAddresses).not.toContain('MSIG_NEW')
    })

    it('does not fire when there are no duplicates', async () => {
        vi.mocked(useAllAccounts).mockReturnValue([account('ADDR1')])

        vi.mocked(fetchInbox).mockResolvedValue({
            joint_account_import_requests: [
                {
                    custom_id: 'c',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_NEW',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
            ],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        })

        const { result } = renderHook(
            () => useCleanupDuplicateMultisigInvitations(),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(result.current).toBeUndefined()
        })

        expect(mutateMock).not.toHaveBeenCalled()
    })

    it('does not re-fire across re-renders for the same duplicate', async () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            account('MSIG_DUP_1', { kind: 'multisig' }),
        ])

        vi.mocked(fetchInbox).mockResolvedValue({
            joint_account_import_requests: [
                {
                    custom_id: 'a',
                    creation_datetime: '2025-01-15T00:00:00Z',
                    address: 'MSIG_DUP_1',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['ADDR1', 'ADDR2'],
                },
            ],
            joint_account_sign_requests: [],
            asa_inboxes: [],
        })

        const { rerender } = renderHook(
            () => useCleanupDuplicateMultisigInvitations(),
            { wrapper: createWrapper() },
        )

        await waitFor(() => {
            expect(mutateMock).toHaveBeenCalledTimes(1)
        })

        rerender()
        rerender()

        expect(mutateMock).toHaveBeenCalledTimes(1)
    })
})
