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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useOnboardingScreen } from '../useOnboardingScreen'

const mockPush = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush }),
}))

// useFocusEffect fires its callback once on mount (screen gains focus).
vi.mock('@react-navigation/native', () => ({
    useFocusEffect: (cb: () => void) => cb(),
}))

vi.mock('@hooks/useIsMounted', () => ({ useIsMounted: () => () => true }))
vi.mock('@modules/webview', () => ({ useWebView: () => ({ pushWebView: vi.fn() }) }))
vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}))
vi.mock('@modules/bottom-sheet', () => ({ useBottomSheet: () => ({ request: vi.fn() }) }))
vi.mock('@modules/onboarding/hooks', () => ({
    useIsOnboarding: () => ({ setIsOnboarding: vi.fn() }),
}))

// Terms already accepted -> ensureTermsAccepted resolves true immediately.
vi.mock('../../../hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => ({ needsAcceptance: false }),
}))

const mockBuildHdWalletAccount = vi.fn(async () => ({ address: 'ADDR' }))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useCreateAccount: () => ({ buildHdWalletAccount: mockBuildHdWalletAccount }),
}))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    OnboardingEvent: { CreateNewWallet: 'create', ImportAccount: 'import' },
}))

// The global setup mock omits `useSettingsStore`, which the (real) config graph
// reaches once config is left unmocked. Provide a permissive selector stub.
vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: () => ({ theme: 'light', privacyMode: false }),
    usePreferences: () => ({ getPreference: vi.fn(), setPreference: vi.fn() }),
    useSettingsStore: (selector?: (state: unknown) => unknown) =>
        typeof selector === 'function' ? selector({}) : {},
}))

// Keep the real module (stores/logger the render harness needs) and only make
// the deferred callback run synchronously, so the test doesn't race setTimeout.
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        deferToNextCycle: (cb: () => unknown) => cb(),
    }
})

// Stubbed: its real import graph pulls the webview + persisted stores.
vi.mock('../../../components/TermsAndConditionsSheet', () => ({
    TermsAndConditionsSheet: () => null,
}))

vi.mock('@hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('@hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }))

describe('useOnboardingScreen — double-tap guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('navigates only once when the create button is tapped twice in the same tick', async () => {
        const { result } = renderHook(() => useOnboardingScreen())

        await act(async () => {
            result.current.handleCreateAccount()
            result.current.handleCreateAccount()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('navigates only once when the import button is tapped twice in the same tick', async () => {
        const { result } = renderHook(() => useOnboardingScreen())

        await act(async () => {
            result.current.handleImportAccount()
            result.current.handleImportAccount()
        })

        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('ImportAccountOptions')
    })
})
