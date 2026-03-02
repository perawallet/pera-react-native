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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../../../test-utils'
import { useCreateDeviceMutation } from '../useCreateDeviceMutation'
import { createDevice } from '../endpoints'
import { DevicePlatforms } from '../../models'

vi.mock('../endpoints', () => ({
    createDevice: vi.fn(),
}))

vi.mock('../useNetwork', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'test-network' }),
}))

describe('useCreateDeviceMutation', () => {
    it('should call createDevice with correct arguments', async () => {
        const { result } = renderHook(() => useCreateDeviceMutation(), {
            wrapper: createWrapper(),
        })

        const mockData = {
            id: 'test-id',
            model: 'test-model',
            platform: DevicePlatforms.ios,
            locale: 'en',
            version: '1.0.0',
            push_token: 'test-token',
            accounts: [],
        }

        result.current.mutate({ data: mockData })

        await waitFor(() => {
            expect(createDevice).toHaveBeenCalledWith(
                expect.anything(),
                mockData,
            )
        })
    })
})
