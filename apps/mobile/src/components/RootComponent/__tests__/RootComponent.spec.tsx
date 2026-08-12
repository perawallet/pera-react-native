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

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { act, render, screen } from '@test-utils/render'
import { RootComponent } from '../RootComponent'
import { useAutoLockListener } from '@modules/security/components/AutoLockGuard/useAutoLockListener'
import { useLockScreen } from '@modules/security/components/AutoLockGuard/useLockScreen'

// PERA-4870: PromptContainer (T&C re-acceptance, PIN setup) must render
// (a) inside RootContentContainer, above the navigator, and (b) inside
// AutoLockGuard's children so the lock overlay hides it. A JSX reorder that
// moves it outside AutoLockGuard would silently reintroduce the orphaned
// touch-swallowing bug this branch fixed — this test pins that mount point
// by driving the real AutoLockGuard + PromptContainer + usePromptContainer
// through the guard's public hook seams, everything else stubbed inert.

vi.mock('@routes/index', () => ({ MainRoutes: () => null }))
vi.mock('@modules/webview', () => ({ WebViewOverlay: () => null }))
vi.mock('@components/OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('@modules/walletconnect/providers/WalletConnectProvider', () => ({
    WalletConnectProvider: ({ children }: React.PropsWithChildren) => children,
}))
vi.mock('@modules/walletconnect/components/PairingProgressOverlay', () => ({
    PairingProgressOverlay: () => null,
}))
vi.mock('@modules/signing/components/SigningOverlays', () => ({
    SigningOverlays: () => null,
}))
vi.mock('@modules/multisig/components/MultisigOverlays', () => ({
    MultisigOverlays: () => null,
}))
vi.mock('@modules/swap/components/SwapOverlays', () => ({
    SwapOverlays: () => null,
}))
vi.mock(
    '@modules/multisig/hooks/useSyncMultisigAccountsOnNetworkSwitch',
    () => ({
        useSyncMultisigAccountsOnNetworkSwitch: vi.fn(),
    }),
)
vi.mock('@modules/network', () => ({
    useNetworkStatusListener: vi.fn(),
}))
vi.mock('@modules/token', () => ({
    useTokenListener: vi.fn(),
}))
vi.mock('@hooks/useNotificationDeeplinkListener', () => ({
    useNotificationDeeplinkListener: vi.fn(),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceRegistration: vi.fn(),
}))
// Pairs with the useDeviceRegistration stub above to keep DeviceRegistrar
// inert; without it the real hook reaches into wallet-core-messages, which the
// full-module mock below deliberately does not carry.
vi.mock('@hooks/useDeviceAccountRegistrations', () => ({
    useDeviceAccountRegistrations: vi.fn(() => []),
}))
vi.mock('@perawallet/wallet-core-migrate', () => ({
    useNeedsMigration: vi.fn(() => ({
        isChecking: false,
        needsMigration: false,
    })),
}))
vi.mock('@perawallet/wallet-core-messages', () => ({
    useReplayNotificationMutes: vi.fn(() => vi.fn()),
}))
vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(() => ({
        checkPinEnabled: vi.fn().mockResolvedValue(false),
    })),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => [{ address: 'ACCOUNT_1' }]),
    useHasAccounts: vi.fn(() => true),
    useSyncNewAccounts: vi.fn(),
}))

// The T&C gate is the trigger this test drives: real usePromptContainer,
// stubbed content so the assertion is "is the prompt slot visible", not a
// re-test of TermsAcceptanceView's own WebView rendering.
const mockUseTermsAcceptance = vi.fn()
vi.mock('@modules/onboarding/hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => mockUseTermsAcceptance(),
}))
vi.mock('@modules/onboarding/components/TermsAndConditionsSheet', () => ({
    TERMS_ACCEPTANCE_PROMPT_ID: 'terms_acceptance_prompt',
    TermsAcceptancePrompt: () => (
        <div data-testid='terms-acceptance-prompt'>terms-acceptance-prompt</div>
    ),
}))

// AutoLockGuard's own JSX (the display-hiding wrapper + LockOverlayProvider)
// stays real; only its two data-fetching hooks are stubbed so the guard's
// active/inactive state is directly controllable per test.
vi.mock(
    '@modules/security/components/AutoLockGuard/useAutoLockListener',
    () => ({
        useAutoLockListener: vi.fn(),
    }),
)
vi.mock('@modules/security/components/AutoLockGuard/useLockScreen', () => ({
    useLockScreen: vi.fn(),
}))

const setGuardActive = (isChecking: boolean) => {
    ;(useAutoLockListener as Mock).mockReturnValue({
        isLocked: false,
        isChecking,
        unlock: vi.fn(),
        handleResetData: vi.fn(),
    })
    ;(useLockScreen as Mock).mockReturnValue({
        hasError: false,
        isLockedOut: false,
        remainingSeconds: 0,
        isDuressWipeInProgress: false,
        handlePinComplete: vi.fn(),
        handleErrorAnimationComplete: vi.fn(),
    })
}

describe('RootComponent PromptContainer mount point', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockUseTermsAcceptance.mockReturnValue({
            needsAcceptance: true,
            currentVersion: '2',
            acceptCurrentTerms: vi.fn(),
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('shows the T&C prompt after the display delay once the lock guard clears', () => {
        setGuardActive(false)

        render(<RootComponent fcmToken={null} />)

        expect(screen.queryByTestId('terms-acceptance-prompt')).toBeNull()

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(screen.getByTestId('terms-acceptance-prompt')).toBeTruthy()
    })

    it('never surfaces the prompt while the lock guard is active', () => {
        setGuardActive(true)

        render(<RootComponent fcmToken={null} />)

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(screen.queryByTestId('terms-acceptance-prompt')).toBeNull()
    })
})
