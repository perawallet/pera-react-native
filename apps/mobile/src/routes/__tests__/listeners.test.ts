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

// @vitest-environment node

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    screenListeners,
    resetPreviousRouteNameForTesting,
    resetTrackedScreenForTesting,
} from '../listeners'
import {
    trackScreen,
    trackEvent,
    AnalyticsScreenName,
    NavigationEvent,
} from '@analytics'

const logEventMock = vi.fn()

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        analytics: {
            logEvent: logEventMock,
        },
    }),
}))

vi.mock('@analytics', () => ({
    trackScreen: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsScreenName: {
        AccountList: 'screen_accounts',
        AssetDetail: 'screen_asset_detail',
        CollectibleList: 'screen_collectibles',
        ContactDetail: 'screen_contact_detail',
        ContactList: 'screen_contacts',
    },
    AnalyticsMetadataKey: {
        PageTitle: 'page_title',
        PreviousScreen: 'previous',
        Path: 'path',
    },
    NavigationEvent: {
        PageView: 'page_view',
    },
}))

describe('screenListeners', () => {
    // Helper to create a route object
    const createRoute = (
        name: string,
        path?: string,
        params?: Record<string, unknown>,
    ) => ({
        name,
        path,
        params,
        key: `${name}-key`,
    })

    beforeEach(() => {
        vi.clearAllMocks()
        resetPreviousRouteNameForTesting()
        resetTrackedScreenForTesting()
    })

    it('logs event on focus for tracked screens (not in ignored list)', () => {
        // AssetDetail is not in NAVIGATION_STACK_NAMES
        const route = createRoute('AssetDetail')
        const listeners = screenListeners({ route: route as any })
        listeners.focus()

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

    it('logs unknown if route name is missing', () => {
        const route = { name: undefined as any, path: '/test' }
        const listeners = screenListeners({ route: route as any })
        listeners.focus()

        expect(logEventMock).toHaveBeenCalledWith('scr_unknown_view', {
            previous: null,
            path: '/test',
        })
    })

    describe('page_view tracking', () => {
        it('fires page_view with the view title alongside the scr_ event', () => {
            screenListeners({
                route: createRoute('AssetDetail') as any,
            }).focus()

            expect(trackEvent).toHaveBeenCalledWith(NavigationEvent.PageView, {
                page_title: 'assetdetail',
                previous: null,
                path: undefined,
            })
        })

        it('carries the previous view on subsequent navigations', () => {
            screenListeners({
                route: createRoute('AssetDetail') as any,
            }).focus()
            screenListeners({
                route: createRoute('SendAlgo', '/send') as any,
            }).focus()

            expect(trackEvent).toHaveBeenLastCalledWith(
                NavigationEvent.PageView,
                {
                    page_title: 'sendalgo',
                    previous: 'assetdetail',
                    path: '/send',
                },
            )
        })

        it('does not fire for ignored stacks or when staying on the same screen', () => {
            screenListeners({ route: createRoute('Home') as any }).focus()
            expect(trackEvent).not.toHaveBeenCalled()

            const route = createRoute('SendAlgo')
            screenListeners({ route: route as any }).focus()
            vi.mocked(trackEvent).mockClear()
            screenListeners({ route: route as any }).focus()
            expect(trackEvent).not.toHaveBeenCalled()
        })
    })

    describe('typed catalog screen tracking', () => {
        it.each([
            ['AccountDetails', AnalyticsScreenName.AccountList],
            ['CollectibleDetails', AnalyticsScreenName.CollectibleList],
            ['ContactsList', AnalyticsScreenName.ContactList],
            ['ViewContact', AnalyticsScreenName.ContactDetail],
        ])('maps route %s to its catalog screen', (routeName, screen) => {
            screenListeners({
                route: createRoute(routeName) as any,
            }).focus()

            expect(trackScreen).toHaveBeenCalledWith(screen)
        })

        it('does not track a catalog screen for an unmapped route', () => {
            screenListeners({ route: createRoute('SendAlgo') as any }).focus()

            expect(trackScreen).not.toHaveBeenCalled()
            // ...but the generic view event still fires.
            expect(logEventMock).toHaveBeenCalledWith(
                'scr_sendalgo_view',
                expect.anything(),
            )
        })

        it('fires once per route instance (dedups by key)', () => {
            const route = createRoute('AccountDetails')
            screenListeners({ route: route as any }).focus()
            screenListeners({ route: route as any }).focus()

            expect(trackScreen).toHaveBeenCalledTimes(1)
        })

        it('tracks AssetDetails as the asset view only when it is a real asset', () => {
            screenListeners({
                route: createRoute('AssetDetails', undefined, {
                    assetId: '123',
                    isCollectible: false,
                }) as any,
            }).focus()

            expect(trackScreen).toHaveBeenCalledWith(
                AnalyticsScreenName.AssetDetail,
            )
        })

        it('does not track AssetDetails for a collectible or without an asset id', () => {
            screenListeners({
                route: createRoute('AssetDetails', undefined, {
                    assetId: '123',
                    isCollectible: true,
                }) as any,
            }).focus()
            screenListeners({
                route: createRoute('AssetDetails', undefined, {}) as any,
            }).focus()

            expect(trackScreen).not.toHaveBeenCalled()
        })
    })
})
