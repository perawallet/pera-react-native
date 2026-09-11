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

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

const { configFlags } = vi.hoisted(() => ({
    configFlags: { isDev: false, isStaging: false },
}))
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        get isDev() {
            return configFlags.isDev
        },
        get isStaging() {
            return configFlags.isStaging
        },
    }
})

import { createCard } from '../endpoints'
import {
    CardAccountLinkedElsewhereError,
    CardCreateInProgressError,
    CardCreateUnavailableError,
    CardOwnershipProofRejectedError,
    CardSetupIncompleteError,
} from '../errors'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

describe('createCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        configFlags.isDev = false
        configFlags.isStaging = false
    })

    it('POSTs /api/v3/baanx/escrow-card on the proxy route with the integrity header', async () => {
        request.mockResolvedValue({
            data: { cardAddress: 'ESCROW_CARD', txId: 'TX123' },
        })

        const result = await createCard({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            baanxUserId: 'baanx-user-1',
            currency: 'usdc',
            signData,
            signature: 'c2ln',
            integrityToken: 'INTEGRITY_TOKEN',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'proxy',
                method: 'POST',
                path: '/api/v3/baanx/escrow-card',
                // Minting waits on chain confirmation, so the 10 s default is too short.
                timeoutMs: 60_000,
                data: {
                    address: 'FUNDING_ADDR',
                    baanx_user_id: 'baanx-user-1',
                    currency: 'usdc',
                    signData,
                    signature: 'c2ln',
                },
                headers: { 'x-app-integrity-token': 'INTEGRITY_TOKEN' },
            }),
        )
        expect(result).toEqual({ cardAddress: 'ESCROW_CARD', txId: 'TX123' })
    })

    it('adds the integrity-bypass header on a development build', async () => {
        configFlags.isDev = true
        request.mockResolvedValue({
            data: { cardAddress: 'ESCROW_CARD', txId: 'TX123' },
        })

        await createCard({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            baanxUserId: 'baanx-user-1',
            currency: 'usdc',
            signData,
            signature: 'c2ln',
            integrityToken: '',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: {
                    'x-app-integrity-token': '',
                    'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY',
                },
            }),
        )
    })

    it('adds the integrity-bypass header on a staging build', async () => {
        configFlags.isStaging = true
        request.mockResolvedValue({
            data: { cardAddress: 'ESCROW_CARD', txId: 'TX123' },
        })

        await createCard({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            baanxUserId: 'baanx-user-1',
            currency: 'usdc',
            signData,
            signature: 'c2ln',
            integrityToken: 'INTEGRITY_TOKEN',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: {
                    'x-app-integrity-token': 'INTEGRITY_TOKEN',
                    'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY',
                },
            }),
        )
    })

    it('rejects on a malformed response', async () => {
        request.mockResolvedValue({ data: { cardAddress: 'ESCROW_CARD' } })

        await expect(
            createCard({
                network: 'testnet',
                address: 'FUNDING_ADDR',
                currency: 'usdc',
                signData,
                signature: 'c2ln',
                integrityToken: 'INTEGRITY_TOKEN',
            }),
        ).rejects.toThrow()
    })
})

describe('createCard error mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        configFlags.isDev = false
        configFlags.isStaging = false
    })

    const params = {
        network: 'testnet',
        address: 'FUNDING_ADDR',
        baanxUserId: 'baanx-user-1',
        currency: 'usdc',
        signData,
        signature: 'c2ln',
        integrityToken: 'INTEGRITY_TOKEN',
    } as const

    it('maps the backend 400 (address linked to a different Baanx user) to CardAccountLinkedElsewhereError', async () => {
        request.mockRejectedValue(
            Object.assign(new Error('Bad Request'), {
                response: { status: 400 },
                data: {
                    status: 400,
                    error: 'Account address is already linked to another Baanx user',
                },
            }),
        )

        await expect(createCard(params)).rejects.toThrow(
            CardAccountLinkedElsewhereError,
        )
    })

    const rejectWith = (status: number, code?: string) =>
        request.mockRejectedValue(
            Object.assign(new Error(`HTTP ${status}`), {
                response: { status },
                data: code ? { status, code, error: code } : undefined,
            }),
        )

    it('maps ACCOUNT_LINKED_ELSEWHERE by code regardless of status', async () => {
        rejectWith(409, 'ACCOUNT_LINKED_ELSEWHERE')

        await expect(createCard(params)).rejects.toThrow(
            CardAccountLinkedElsewhereError,
        )
    })

    it('maps the 409 creation lock to CardCreateInProgressError', async () => {
        rejectWith(409, 'CREATE_IN_PROGRESS')

        await expect(createCard(params)).rejects.toThrow(
            CardCreateInProgressError,
        )
    })

    it('maps a missing Baanx card record to CardSetupIncompleteError', async () => {
        rejectWith(404, 'BAANX_ACCOUNT_NOT_FOUND')

        await expect(createCard(params)).rejects.toThrow(
            CardSetupIncompleteError,
        )
    })

    it('maps a rejected ownership proof (401) and keeps the backend code', async () => {
        rejectWith(401, 'ARC60_SIGNATURE_INVALID')

        await expect(createCard(params)).rejects.toMatchObject({
            name: 'CardOwnershipProofRejectedError',
            code: 'ARC60_SIGNATURE_INVALID',
        })
        await expect(createCard(params)).rejects.toThrow(
            CardOwnershipProofRejectedError,
        )
    })

    it('maps every 5xx to CardCreateUnavailableError with the backend code', async () => {
        rejectWith(502, 'CARD_CREATE_FAILED')
        await expect(createCard(params)).rejects.toMatchObject({
            name: 'CardCreateUnavailableError',
            code: 'CARD_CREATE_FAILED',
        })

        rejectWith(503, 'ALGOD_UNAVAILABLE')
        await expect(createCard(params)).rejects.toThrow(
            CardCreateUnavailableError,
        )

        rejectWith(500)
        await expect(createCard(params)).rejects.toThrow(
            CardCreateUnavailableError,
        )
    })

    it('propagates rejections it cannot classify unchanged', async () => {
        request.mockRejectedValue(
            Object.assign(new Error('unprocessable'), {
                response: { status: 422 },
                data: { status: 422, code: 'VALIDATION' },
            }),
        )

        await expect(createCard(params)).rejects.toThrow('unprocessable')
    })
})
