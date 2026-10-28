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
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createWrapper } from '@test-utils'
import { useRegisterDeviceMutation } from '../useRegisterDeviceMutation'
import { registerDevice } from '../endpoints'
import type { DeviceRegistration } from '../../models'

vi.mock('../endpoints', () => ({
    registerDevice: vi.fn(),
}))

const mockedRegisterDevice = vi.mocked(registerDevice)

const registration: DeviceRegistration = {
    pushToken: 'fcm-token',
    platform: 'ios',
    locale: 'en-US',
    appVersion: '7.0.1',
    accounts: [
        {
            chainId: 'algorand',
            address: 'ADDR_A',
            accountType: 'signing-kind',
            rank: 2,
            receiveNotifications: true,
        },
    ],
}

const wrapper = createWrapper()

describe('useRegisterDeviceMutation', () => {
    // `useDevice.registerDevice` queues registrations behind one another, so
    // a call enqueued on the live deployment can run after the user switched
    // to developer. The deployment is a mutation variable the caller pins at
    // enqueue time, and this hook must honour it and nothing else.
    it('sends the registration to the deployment passed in the mutation variables', async () => {
        mockedRegisterDevice.mockResolvedValueOnce({ platform: 'ios' })

        const { result } = renderHook(() => useRegisterDeviceMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.mutateAsync({
                deployment: 'developer',
                data: registration,
            })
        })

        expect(mockedRegisterDevice).toHaveBeenCalledWith(
            'developer',
            registration,
        )
    })

    it('opts out of throwOnError so a failed registration cannot crash a render', async () => {
        mockedRegisterDevice.mockRejectedValueOnce(new Error('boom'))

        // `throwOnError` governs whether a subsequent render re-throws the
        // mutation's error, not whether `mutateAsync` rejects — `mutateAsync`
        // always rejects on failure regardless of this option. So the real
        // regression to guard against is a re-render throwing, which only
        // shows up when the surrounding QueryClient mirrors the app's actual
        // global default (`mutations.throwOnError: true`, see
        // `mutationDefaults` in `@perawallet/wallet-core-shared`). The
        // package-local `createWrapper` doesn't set that default, so it
        // can't observe the crash this hook's override prevents.
        const productionLikeWrapper = ({
            children,
        }: {
            children: React.ReactNode
        }) => {
            const queryClient = new QueryClient({
                defaultOptions: {
                    mutations: { throwOnError: true, retry: false },
                },
            })
            return React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
        }

        const { result, rerender } = renderHook(
            () => useRegisterDeviceMutation(),
            { wrapper: productionLikeWrapper },
        )

        await act(async () => {
            await expect(
                result.current.mutateAsync({
                    network: 'mainnet',
                    data: registration,
                }),
            ).rejects.toThrow('boom')
        })

        // With throwOnError: true (the global default), useMutation would
        // re-throw the error during render here, crashing the screen. The
        // hook's local `throwOnError: false` override must prevent that.
        expect(() => rerender()).not.toThrow()
    })
})
