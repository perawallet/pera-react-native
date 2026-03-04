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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock dependencies
const mockSendShouldRefreshRequest = vi.fn()
vi.mock('../endpoints', () => ({
    sendShouldRefreshRequest: mockSendShouldRefreshRequest,
}))

const mockUseNetwork = vi.fn().mockReturnValue({ network: 'mainnet' })
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => mockUseNetwork(),
}))

const mockUseAllAccounts = vi.fn().mockReturnValue([])
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

const mockLastRefreshedRound = 100
vi.mock('../../store', () => ({
    usePollingStore: (selector: any) => {
        const state = {
            lastRefreshedRound: mockLastRefreshedRound,
        }
        return selector(state)
    },
}))

describe('services/polling/useShouldRefreshMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls sendShouldRefreshRequest with correct arguments', async () => {
        vi.resetModules()
        const { registerTestPlatform, createWrapper } = await import(
            '@perawallet/wallet-extension-platform'
        )
        registerTestPlatform()

        mockUseAllAccounts.mockReturnValue([
            { address: 'ADDR1' },
            { address: 'ADDR2' },
        ])

        const { useShouldRefreshMutation } = await import(
            '../useShouldRefreshMutation'
        )
        const { result } = renderHook(() => useShouldRefreshMutation(), {
            wrapper: createWrapper(),
        })

        await result.current.mutateAsync()

        expect(mockSendShouldRefreshRequest).toHaveBeenCalledWith(
            'mainnet',
            ['ADDR1', 'ADDR2'],
            100,
        )
    })
})
