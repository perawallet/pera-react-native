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
import { CardAccountLinkedElsewhereError } from '../errors'

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

    it('propagates non-400 rejections unchanged', async () => {
        request.mockRejectedValue(
            Object.assign(new Error('server exploded'), {
                response: { status: 503 },
            }),
        )

        await expect(createCard(params)).rejects.toThrow('server exploded')
    })
})
