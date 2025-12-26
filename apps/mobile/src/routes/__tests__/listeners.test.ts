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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { screenListeners, resetPreviousRouteNameForTesting } from '../listeners'
import { container } from 'tsyringe'
import { AnalyticsServiceContainerKey } from '@perawallet/wallet-core-platform-integration'


jest.mock('tsyringe', () => ({
    container: {
        resolve: jest.fn(),
    },
}))

describe('screenListeners', () => {
    const logEventMock = jest.fn()

    // Helper to create a route object
    const createRoute = (name: string, path?: string) => ({
        name,
        path,
        key: `${name}-key`,
    })

    beforeEach(() => {
        jest.clearAllMocks()
        resetPreviousRouteNameForTesting()
            ; (container.resolve as any).mockReturnValue({
                logEvent: logEventMock,
            })
    })

    it('logs event on focus for tracked screens (not in ignored list)', () => {
        // AssetDetail is not in NAVIGATION_STACK_NAMES
        const route = createRoute('AssetDetail')
        const listeners = screenListeners({ route: route as any })
        listeners.focus()

        expect(container.resolve).toHaveBeenCalledWith(
            AnalyticsServiceContainerKey,
        )
        expect(logEventMock).toHaveBeenCalledWith('scr_assetdetail_view', {
            previous: null, // Initial previous is null
            path: undefined,
        })
    })

    it('does not log event for ignored stacks (e.g. Home)', () => {
        const route = createRoute('Home')
        const listeners = screenListeners({ route: route as any })
        listeners.focus()

        expect(logEventMock).not.toHaveBeenCalled()
    })

    it('updates previous route name and logs correct previous screen', () => {
        // 1. Visit AssetDetail (logs, sets previous = assetdetail)
        const route1 = createRoute('AssetDetail')
        screenListeners({ route: route1 as any }).focus()

        expect(logEventMock).toHaveBeenLastCalledWith(
            'scr_assetdetail_view',
            expect.anything(),
        )

        // 2. Visit SendAlgo (logs, should have previous = assetdetail)
        const route2 = createRoute('SendAlgo')
        screenListeners({ route: route2 as any }).focus()

        expect(logEventMock).toHaveBeenLastCalledWith('scr_sendalgo_view', {
            previous: 'assetdetail',
            path: undefined,
        })
    })

    it('does not log if staying on same screen', () => {
        // 1. Visit SendAlgo first to set state
        const route = createRoute('SendAlgo')
        screenListeners({ route: route as any }).focus()

        // Clear mocks to reset call count
        logEventMock.mockClear()

        // 2. Visit SendAlgo again
        screenListeners({ route: route as any }).focus()

        expect(logEventMock).not.toHaveBeenCalled()
    })
})
