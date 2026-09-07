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

// migrating from Pera 6 landed the user in a pile of unrelated
// interruptions — terms, then the PIN screen, then a Pera 7 announcement, then
// terms again — because each decided independently when to appear.
//
// These exercise the real queue against the real banner stack (served over
// MSW), rather than the unit tests' stubbed candidates: ordering across all
// three, the delay being paid once for the session, and the guarantee that no
// bottom sheet paints while the legal gate is up.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient, render, screen } from '@test-utils/render'
import { mockBanners } from '@perawallet/wallet-core-banners/test-handlers'
import { useBannersStore } from '@perawallet/wallet-core-banners'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { usePromptStore } from '@modules/prompts/store'
import { UserPreferences } from '@constants/user-preferences'
import { LONG_PROMPT_DISPLAY_DELAY } from '@constants/ui'

const DEVICE_ID = 'prompt-arbiter-device'
const NETWORK = 'mainnet' as const
const TERMS_PROMPT_ID = 'terms_acceptance_prompt'
const BANNER_PROMPT_ID = 'banner_prompt'

const mocks = vi.hoisted(() => ({
    needsTermsAcceptance: false,
    isPinEnabled: false,
    preferences: {} as Record<string, unknown>,
}))

vi.mock('@modules/onboarding/hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => ({
        currentVersion: '2',
        needsAcceptance: mocks.needsTermsAcceptance,
        acceptCurrentTerms: vi.fn(),
    }),
}))

// Spread the real modules rather than replacing them: the banner stack and the
// stores underneath it are exercised for real here, and only the few hooks the
// queue reads are stubbed.
vi.mock('@perawallet/wallet-core-security', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-security')
    >()),
    usePinCode: () => ({
        checkPinEnabled: () => Promise.resolve(mocks.isPinEnabled),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useHasAccounts: () => true,
}))

vi.mock('@perawallet/wallet-core-settings', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-settings')
    >()),
    usePreferences: () => ({
        getPreference: (key: string) => mocks.preferences[key] ?? null,
        setPreference: (key: string, value: unknown) => {
            mocks.preferences[key] = value
        },
    }),
}))

import { usePromptContainer } from '@modules/prompts/components/PromptContainer/usePromptContainer'
import { PromptContainer } from '@modules/prompts/components/PromptContainer'

const forcedBannerResponse = {
    count: 1,
    results: [
        {
            id: 21,
            type: 'generic' as const,
            title: 'Pera 7 is here',
            button_label: 'Take a look',
            button_url: 'pera://home',
            is_button_url_external: false,
            auto_open_mode: 'force' as const,
        },
    ],
}

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: prompt arbiter', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterAll(() => server.close())

    beforeEach(() => {
        // shouldAdvanceTime: waitFor polls on real timers, so a frozen clock
        // deadlocks every await in this file.
        vi.useFakeTimers({ shouldAdvanceTime: true })
        useDeviceStore.getState().setDeviceID(NETWORK, DEVICE_ID)
        mocks.needsTermsAcceptance = false
        mocks.isPinEnabled = false
        mocks.preferences = {}
    })

    afterEach(() => {
        vi.useRealTimers()
        server.resetHandlers()
        act(() => {
            useBannersStore.getState().resetState()
            usePromptStore.getState().resetState()
            useBottomSheetStore.getState().resetState()
        })
    })

    it('runs the migration interruptions as one ordered flow', async () => {
        mocks.needsTermsAcceptance = true
        server.use(
            mockBanners({
                deviceID: DEVICE_ID,
                response: forcedBannerResponse,
            }),
        )

        const { result } = renderHook(() => usePromptContainer(), {
            wrapper: buildWrapper(),
        })

        // The terms gate is legally required, so it comes first and does not
        // wait behind the display delay.
        await waitFor(() =>
            expect(result.current.nextPrompt?.id).toBe(TERMS_PROMPT_ID),
        )

        mocks.needsTermsAcceptance = false
        await act(async () => {
            result.current.hidePrompt(TERMS_PROMPT_ID)
        })

        // The announcement is server-flagged `force`, so it outranks the PIN
        // nudge — it may be carrying a forced update notice.
        await waitFor(() =>
            expect(result.current.nextPrompt?.id).toBe(BANNER_PROMPT_ID),
        )

        await act(async () => {
            result.current.hidePrompt(BANNER_PROMPT_ID)
        })

        // No timer advance anywhere in this test: the delay is a property of
        // the session, so the second and third follow the first immediately.
        await waitFor(() =>
            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            ),
        )
    })

    it('keeps the forced banner on screen once it opens', async () => {
        // Renders the real container, not just the hook: the queue asks
        // useBannerPrompt whether a banner is due, and BannerPrompt marks the
        // banner as having had its turn. Marking that on mount made the prompt
        // un-due the instant it appeared, so it unmounted itself and the banner
        // never opened — invisible to a renderHook test, which never mounts the
        // component at all.
        server.use(
            mockBanners({
                deviceID: DEVICE_ID,
                response: forcedBannerResponse,
            }),
        )

        render(<PromptContainer />)

        const banner = await screen.findByTestId(BANNER_PROMPT_ID)
        expect(banner).toBeTruthy()

        // Still there after the queue has had several chances to re-evaluate.
        await act(async () => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })
        expect(screen.queryByTestId(BANNER_PROMPT_ID)).toBeTruthy()
    })

    it('never lets a bottom sheet paint while the terms gate is up', async () => {
        mocks.needsTermsAcceptance = true

        const { result } = renderHook(() => usePromptContainer(), {
            wrapper: buildWrapper(),
        })

        await waitFor(() =>
            expect(result.current.nextPrompt?.id).toBe(TERMS_PROMPT_ID),
        )

        // A sheet requested under a live legal gate must be held, not painted.
        // The hold engaging with the gate rather than ahead of it is what
        // makes this safe without a silent dead zone.
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)
    })

    it('leaves sheets alone when only the PIN nudge is waiting', async () => {
        // The nudge is not a gate. Holding here is what silently swallowed
        // taps for the length of the display delay.
        const { result } = renderHook(() => usePromptContainer(), {
            wrapper: buildWrapper(),
        })

        // Asserted before any await: renderHook has already flushed effects, and
        // the clock advances with real time here, so awaiting would let the
        // display delay elapse and close the very window under test.
        expect(result.current.nextPrompt).toBeUndefined()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)

        await act(async () => {
            vi.advanceTimersByTime(LONG_PROMPT_DISPLAY_DELAY)
        })

        await waitFor(() =>
            expect(result.current.nextPrompt?.id).toBe(
                UserPreferences._securityPinSetupPrompt,
            ),
        )
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)
    })
})
