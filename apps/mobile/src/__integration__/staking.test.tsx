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

// Staking: the project list, the disclaimer gate, and list/loading/error/empty
// rendering.
//
// The list comes from Remote Config, not the API — the API only supplies
// per-project TVL — so the config is seeded via the real override store and the
// TVL via MSW. `mapProjects` sorts by descending tvlInAlgo, which is asserted.
// wallet-core-staking is unmocked here so the real query runs end-to-end.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { mockStakingProjects } from '@perawallet/wallet-core-staking/test-handlers'
import {
    RemoteConfigKeys,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { useSettingsStore } from '@perawallet/wallet-core-settings'

import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useWebViewStore } from '@modules/webview'
import { StakingScreen } from '@modules/staking/screens/StakingScreen'

const SLOW_TEST_TIMEOUT_MS = 30_000

const STAKING_DISCLAIMER_PREFERENCE = 'staking-disclaimer-accepted'

type ConfigProject = {
    id: string
    title: string
    description: string
    logoUrl: string
    link: string
    type: 'liquid' | 'pools' | 'delegated'
}

const TINYMAN: ConfigProject = {
    id: 'tinyman',
    title: 'Tinyman Liquid',
    description: 'Liquid staking on Algorand',
    logoUrl: 'https://cdn.pera.test/tinyman.png',
    link: 'https://tinyman.org/stake',
    type: 'liquid',
}

const FOLKS: ConfigProject = {
    id: 'folks',
    title: 'Folks Finance',
    description: 'Pooled staking rewards',
    logoUrl: 'https://cdn.pera.test/folks.png',
    link: 'https://folks.finance/stake',
    type: 'pools',
}

const seedProjectsConfig = (projects: ConfigProject[]) => {
    useRemoteConfigStore
        .getState()
        .setConfigOverride(
            RemoteConfigKeys.staking_projects_i18n,
            JSON.stringify(projects),
        )
}

describe('Flow: Staking', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        useSettingsStore.getState().resetState()
        useWebViewStore.getState().clearWebViews()
        useBottomSheetStore.getState().resetState()
    })

    it(
        'Given remote-config projects and TVL data, when the screen resolves, then both cards render sorted by descending TVL',
        async () => {
            seedProjectsConfig([TINYMAN, FOLKS])
            server.use(
                mockStakingProjects({
                    response: {
                        tinyman: {
                            tvl_in_algo: '1000000',
                            tvl_in_usd: '250',
                        },
                        folks: {
                            tvl_in_algo: '5000000',
                            tvl_in_usd: '1250',
                        },
                    },
                }),
            )

            renderWithNavigation(StakingScreen, 'Staking')

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-project-card-folks'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )
            expect(
                screen.getByTestId('staking-project-card-tinyman'),
            ).toBeTruthy()

            const titles = screen
                .getAllByTestId(/^staking-project-title-/)
                .map(node => node.getAttribute('data-testid'))
            // Folks has the larger TVL → sorts first.
            expect(titles).toEqual([
                'staking-project-title-folks',
                'staking-project-title-tinyman',
            ])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the TVL endpoint errors then succeeds, when the user taps retry, then the list renders',
        async () => {
            seedProjectsConfig([TINYMAN])
            server.use(
                mockStakingProjects({
                    response: {},
                    status: 500,
                }),
            )

            renderWithNavigation(StakingScreen, 'Staking')

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-error-container'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )

            server.resetHandlers()
            server.use(
                mockStakingProjects({
                    response: {
                        tinyman: { tvl_in_algo: '1000000', tvl_in_usd: '250' },
                    },
                }),
            )

            fireEvent.click(screen.getByTestId('staking-retry-button'))

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-project-card-tinyman'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )
            expect(screen.queryByTestId('staking-error-container')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given no projects in remote config, when the screen resolves, then the empty state renders',
        async () => {
            // No config override → parser returns an empty project list.
            server.use(mockStakingProjects({ response: {} }))

            renderWithNavigation(StakingScreen, 'Staking')

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-empty-view'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )
            expect(
                screen.queryByTestId('staking-project-card-tinyman'),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the disclaimer is not accepted, when the user presses a project, then the disclaimer sheet opens; accepting it records acceptance and opens the project webview',
        async () => {
            seedProjectsConfig([TINYMAN])
            server.use(mockStakingProjects({ response: {} }))

            renderWithNavigation(StakingScreen, 'Staking')

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-project-card-tinyman'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )

            fireEvent.click(screen.getByTestId('staking-project-card-tinyman'))

            // The gate opens a request-based bottom sheet rather than the
            // webview while acceptance is unknown.
            await waitFor(() =>
                expect(
                    useBottomSheetStore.getState().requests.length,
                ).toBeGreaterThan(0),
            )
            expect(useWebViewStore.getState().openWebViews).toHaveLength(0)
            expect(
                useSettingsStore
                    .getState()
                    .getPreference(STAKING_DISCLAIMER_PREFERENCE),
            ).toBeFalsy()

            // Simulate the user accepting the disclaimer. The sheet's accept
            // button is gated behind a scroll-to-bottom event that can't fire
            // under jsdom, so resolve the request through the store the same
            // way the rendered accept button would (resolve(true) → remove).
            const { id } = useBottomSheetStore.getState().requests[0]
            useBottomSheetStore.getState().resolve(id, true)
            useBottomSheetStore.getState().remove(id)

            await waitFor(() =>
                expect(
                    useSettingsStore
                        .getState()
                        .getPreference(STAKING_DISCLAIMER_PREFERENCE),
                ).toBe(true),
            )
            await waitFor(() =>
                expect(useWebViewStore.getState().openWebViews).toHaveLength(1),
            )
            expect(useWebViewStore.getState().openWebViews[0].url).toBe(
                TINYMAN.link,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the disclaimer was already accepted, when the user presses a project, then it opens the webview directly without the disclaimer sheet',
        async () => {
            seedProjectsConfig([TINYMAN])
            server.use(mockStakingProjects({ response: {} }))
            useSettingsStore
                .getState()
                .setPreference(STAKING_DISCLAIMER_PREFERENCE, true)

            renderWithNavigation(StakingScreen, 'Staking')

            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('staking-project-card-tinyman'),
                    ).toBeTruthy(),
                { timeout: 5000 },
            )

            fireEvent.click(screen.getByTestId('staking-project-card-tinyman'))

            await waitFor(() =>
                expect(useWebViewStore.getState().openWebViews).toHaveLength(1),
            )
            expect(useWebViewStore.getState().openWebViews[0].url).toBe(
                TINYMAN.link,
            )
            expect(useBottomSheetStore.getState().requests).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
