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

// The extension without a valid integrity token: a Pera read refused with an
// APP_INTEGRITY_* code travels the real request layer as IntegrityRequiredError,
// and the surface renders the integrity arm for the access state the worker
// reports, never the generic error. The worker itself is out of scope: its
// facts are applied to the UI realm's access store directly. Copy is asserted
// by key: this project renders i18n keys.

import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
    INTEGRITY_PENDING_GRACE_MS,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import { mockStakingProjects } from '@perawallet/wallet-core-staking/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// A keyless extension build: the token is the request's only credential.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            webIntegrityMintEnabled: true,
            webIntegrityBearerEnabled: true,
        },
    }
})

// Vitest resolves the native file first; this flow is the web surface.
vi.mock(
    '@hooks/useIntegrityAccessState',
    () => import('@hooks/useIntegrityAccessState.web'),
)

// A wallet past onboarding: the welcome screen defers verification, which the
// access-state hook's own spec covers.
vi.mock('@hooks/useShowOnboarding', () => ({
    useShowOnboarding: () => false,
}))

vi.mock('@perawallet/wallet-core-browser-runtime', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-browser-runtime')
    >()),
    sendIntegrityControl: vi.fn(),
}))

// The integration setup loads the Pera query client before the config mock
// above exists, and the client reads the bearer flag from the config it was
// loaded with, so everything under test is loaded afresh, the test theme the
// setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { sendIntegrityControl } =
    await import('@perawallet/wallet-core-browser-runtime')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { useIntegrityCheckFrameStore } =
    await import('@components/IntegrityCheckFrameHost')
const { useIntegrityAccessStore } =
    await import('@hooks/useIntegrityAccessStore.web')
const { RemoteConfigKeys, useRemoteConfigStore } =
    await import('@perawallet/wallet-core-remote-config')
const { StakingScreen } = await import('@modules/staking')
const { SettingsCurrencyScreen } =
    await import('@modules/settings/screens/SettingsCurrencyScreen/SettingsCurrencyScreen')

const EMPTY: IntegritySnapshot = {
    tokenExpiresAt: null,
    mintBackoff: null,
    enrolBackoff: null,
    attempt: null,
    enrolNeededAt: null,
    lastFailure: null,
    revocations: 0,
}

const TINYMAN = {
    id: 'tinyman',
    title: 'Tinyman Liquid',
    description: 'Liquid staking on Algorand',
    logoUrl: 'https://cdn.pera.test/tinyman.png',
    link: 'https://tinyman.org/stake',
    type: 'liquid',
}

const refuseStakingProjects = (body: Record<string, unknown>) =>
    server.use(
        http.get('*/v1/staking/projects-information/', () =>
            HttpResponse.json(body, { status: 403 }),
        ),
    )

const applyWorkerFacts = (snapshot: IntegritySnapshot) =>
    act(() =>
        useIntegrityAccessStore.getState().applySnapshot(snapshot, Date.now()),
    )

describe('Flow: Pera services without a valid integrity token', () => {
    beforeEach(() => {
        useIntegrityAccessStore.getState().resetState()
        useIntegrityCheckFrameStore.getState().hide()
        vi.mocked(sendIntegrityControl).mockClear()
        useRemoteConfigStore.getState().resetState()
        useRemoteConfigStore
            .getState()
            .setConfigOverride(
                RemoteConfigKeys.staking_projects_i18n,
                JSON.stringify({ en: [TINYMAN] }),
            )
    })

    it('Given the worker cannot mint, when a Pera read is refused, then the surface says Pera is unavailable and Retry asks the worker', async () => {
        applyWorkerFacts({
            ...EMPTY,
            lastFailure: {
                phase: 'mint',
                status: 503,
                at: Date.now(),
                isTransport: false,
            },
        })
        refuseStakingProjects({
            error: 'App integrity token required',
            code: 'APP_INTEGRITY_TOKEN_REQUIRED',
        })

        renderWithNavigation(StakingScreen, 'Staking')

        await screen.findByText(
            'integrityCheck.surface.service_title',
            undefined,
            {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            },
        )
        expect(screen.queryByTestId('staking-error-container')).toBeNull()
        fireEvent.click(screen.getByText('integrityCheck.banner.retry'))
        expect(sendIntegrityControl).toHaveBeenCalledWith({ kind: 'retry' })
    })

    it('Given the install must verify, when a Pera read is refused, then the surface offers Verify to the check host', async () => {
        applyWorkerFacts({
            ...EMPTY,
            lastFailure: {
                phase: 'mint',
                status: 403,
                code: 'APP_INTEGRITY_ENROLMENT_REQUIRED',
                at: Date.now() - INTEGRITY_PENDING_GRACE_MS,
                isTransport: false,
            },
        })
        refuseStakingProjects({
            error: 'App integrity token required',
            code: 'APP_INTEGRITY_TOKEN_REQUIRED',
        })

        renderWithNavigation(StakingScreen, 'Staking')

        await screen.findByText(
            'integrityCheck.surface.verify_title',
            undefined,
            {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            },
        )
        fireEvent.click(screen.getByText('integrityCheck.banner.verify'))
        expect(useIntegrityCheckFrameStore.getState().verifyNonce).toBe(1)
    })

    it('Given a token lands after the refusal, when the user retries, then the data loads', async () => {
        refuseStakingProjects({
            error: 'App integrity token required',
            code: 'APP_INTEGRITY_TOKEN_REQUIRED',
        })
        renderWithNavigation(StakingScreen, 'Staking')
        await screen.findByText(
            'integrityCheck.surface.service_title',
            undefined,
            {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            },
        )

        applyWorkerFacts({ ...EMPTY, tokenExpiresAt: Date.now() + 900_000 })
        server.use(
            mockStakingProjects({
                response: {
                    tinyman: { tvl_in_algo: '1000000', tvl_in_usd: '250' },
                },
            }),
        )
        fireEvent.click(screen.getByText('integrityCheck.banner.retry'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('staking-project-card-tinyman'),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(sendIntegrityControl).not.toHaveBeenCalled()
    })

    it('Given the worker cannot mint, when the currency list is refused, then currency settings shows the integrity surface rather than a blank list', async () => {
        applyWorkerFacts({
            ...EMPTY,
            lastFailure: {
                phase: 'mint',
                status: 503,
                at: Date.now(),
                isTransport: false,
            },
        })
        server.use(
            http.get('*/v1/currencies/', () =>
                HttpResponse.json(
                    {
                        error: 'App integrity token required',
                        code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                    },
                    { status: 403 },
                ),
            ),
        )

        renderWithNavigation(SettingsCurrencyScreen, 'SettingsCurrency')

        await screen.findByText(
            'integrityCheck.surface.service_title',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        fireEvent.click(screen.getByText('integrityCheck.banner.retry'))
        expect(sendIntegrityControl).toHaveBeenCalledWith({ kind: 'retry' })
    })

    it('Given a refusal without an integrity code, when the read fails, then it stays a plain error', async () => {
        refuseStakingProjects({ type: 'PermissionDenied', detail: 'nope' })

        renderWithNavigation(StakingScreen, 'Staking')

        await screen.findByTestId('staking-error-container', undefined, {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(
            screen.queryByText('integrityCheck.surface.service_title'),
        ).toBeNull()
    })
})
