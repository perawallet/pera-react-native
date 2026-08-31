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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import {
    createMultisigAccount,
    getMultisigAccountDetail,
    proposeSignRequest,
    addSignature,
    getSignRequestDetail,
    deleteImportInbox,
    checkIsMultisigAddress,
} from '../endpoints'
import { queryClient, PeraNetworkError } from '@perawallet/wallet-core-shared'

vi.mock(import('@perawallet/wallet-core-shared'), async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        queryClient: vi.fn(),
    }
})

const validAccountResponse = {
    custom_id: 'msig-1',
    creation_datetime: '2025-01-01T00:00:00Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participant_addresses: ['ADDR1', 'ADDR2'],
}

const validSignRequestResponse = {
    id: '1',
    status: 'pending',
    type: 'async',
    creation_datetime: '2025-01-01T00:00:00Z',
    expected_expire_datetime: '2025-01-02T00:00:00Z',
    fail_reason_display: null,
    joint_account: validAccountResponse,
    transaction_lists: [],
}

describe('createMultisigAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validAccountResponse,
        })

        const params = {
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR1', 'ADDR2'],
            device_id: 'device-1',
        }
        await createMultisigAccount('testnet', params)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'POST',
            url: '/v1/joint-accounts/accounts/',
            data: params,
        })
    })

    test('returns parsed response', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validAccountResponse,
        })

        const result = await createMultisigAccount('testnet', {
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR1', 'ADDR2'],
            device_id: 'device-1',
        })
        expect(result.address).toBe('MSIG_ADDR')
    })

    test('throws when response fails schema validation', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { invalid: 'data' },
        })

        await expect(
            createMultisigAccount('testnet', {
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1'],
                device_id: 'device-1',
            }),
        ).rejects.toThrow()
    })
})

describe('getMultisigAccountDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validAccountResponse,
        })

        await getMultisigAccountDetail('mainnet', 'MSIG_ADDR')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/joint-accounts/accounts/MSIG_ADDR/',
        })
    })
})

describe('proposeSignRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validSignRequestResponse,
        })

        const params = {
            joint_account_address: 'MSIG_ADDR',
            proposer_address: 'ADDR1',
            type: 'async',
            raw_transaction_lists: [['tx1']],
            responses: [
                {
                    address: 'ADDR1',
                    response: 'signed' as const,
                    signatures: [['sig1']],
                },
            ],
        }
        await proposeSignRequest('testnet', params)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'POST',
            url: '/v1/joint-accounts/sign-requests/',
            data: params,
        })
    })

    test('returns parsed sign request response', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validSignRequestResponse,
        })

        const result = await proposeSignRequest('testnet', {
            joint_account_address: 'MSIG_ADDR',
            proposer_address: 'ADDR1',
            type: 'async',
            raw_transaction_lists: [['tx1']],
            responses: [
                {
                    address: 'ADDR1',
                    response: 'signed' as const,
                    signatures: [['sig1']],
                },
            ],
        })
        expect(result.status).toBe('pending')
    })
})

describe('addSignature', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validSignRequestResponse,
        })

        const responses = [
            {
                address: 'ADDR1',
                response: 'signed' as const,
                signatures: [['sig1']],
            },
        ]
        await addSignature('testnet', 'sr-1', responses)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'POST',
            url: '/v1/joint-accounts/sign-requests/sr-1/responses/',
            data: responses,
        })
    })
})

describe('getSignRequestDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('routes through the search endpoint with the device id and sign request id', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { count: 1, results: [validSignRequestResponse] },
        })

        const result = await getSignRequestDetail(
            'mainnet',
            'device-7',
            validSignRequestResponse.id,
        )

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'POST',
            url: '/v1/joint-accounts/sign-requests/search/',
            data: {
                device_id: 'device-7',
                sign_request_id: validSignRequestResponse.id,
            },
        })
        expect(result.id).toBe(validSignRequestResponse.id)
    })

    test('throws when no result matches the requested sign request id', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { count: 0, results: [] },
        })

        await expect(
            getSignRequestDetail('mainnet', 'device-7', 'sr-missing'),
        ).rejects.toThrow(
            /Sign request not found in search results: sr-missing/,
        )
    })
})

describe('deleteImportInbox', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with correct params', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: '' })

        await deleteImportInbox('testnet', 'device-1', 'MSIG_ADDR')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'DELETE',
            url: '/v1/joint-accounts/inbox/device-import/device-1/MSIG_ADDR/',
            responseType: 'text',
        })
    })
})

describe('checkIsMultisigAddress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns true when the detail lookup succeeds', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: validAccountResponse,
        })

        await expect(
            checkIsMultisigAddress('mainnet', 'MSIG_ADDR'),
        ).resolves.toBe(true)
    })

    // A plain (non-multisig) address is the common case and the backend answers
    // it with 404, so this must stay swallowed. Uses a real PeraNetworkError —
    // the shape the request layer actually throws — rather than stubbing the
    // status extraction, which is what let a rethrow ship unnoticed.
    test('returns false when the detail lookup 404s', async () => {
        ;(queryClient as Mock).mockRejectedValue(
            new PeraNetworkError('client', { status: 404 }),
        )

        await expect(
            checkIsMultisigAddress('mainnet', 'UNKNOWN'),
        ).resolves.toBe(false)
    })

    test('rethrows non-404 errors', async () => {
        const boom = new PeraNetworkError('server', { status: 500 })
        ;(queryClient as Mock).mockRejectedValue(boom)

        await expect(checkIsMultisigAddress('mainnet', 'ADDR')).rejects.toBe(
            boom,
        )
    })
})
