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

// Settings -> Passkeys. Registration and assertion live in the native
// Credential Provider extension and can't run under jsdom, so this covers what
// the app owns: how the screen resolves its display state and which
// prerequisite warning it surfaces.
//
// Its three inputs are all test doubles: `provider.passkeyAutofill` (rewired
// per scenario), `biometrics.getSecurityLevel()` (spied to 'none' for the
// screen-lock case), and a real accounts store seeded with an HD account.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SettingsPasskeyScreen } from '@modules/settings/screens/SettingsPasskeysScreen'
import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

// The PasskeysHero illustration (rendered in the empty / disabled states)
// imports svgr SVG components whose long data-URL attributes make jsdom throw
// `InvalidCharacterError`. Stub them to inert divs — same approach the shared
// integration setup uses for other SVGs. `vi.mock` is hoisted above the
// imports, so the factory must `require('react')` rather than close over it.
vi.mock('@assets/icons/passkey-hero-light.svg', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})

vi.mock('@assets/icons/passkey-hero-dark.svg', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})

const SLOW_TEST_TIMEOUT_MS = 30_000

const HD_ACCOUNT: WalletAccount = {
    id: 'hd-1',
    type: AccountTypes.hdWallet,
    address: HD_TEST_ADDRESS,
    name: 'Universal',
    keyPairId: 'hd-key-1',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: DerivationTypes.Peikert,
    },
}

const NATIVE_CREDENTIAL: NativeStoredCredential = {
    credentialId: 'cred-123',
    rpId: 'example.com',
    userHandle: 'dXNlci1oYW5kbGU',
    name: 'Alice Example',
    userName: 'alice@example.com',
    createdAt: 1_700_000_000_000,
}

// credentialToPasskey url-safe-base64-encodes the credentialId for the row id;
// 'cred-123' has no base64-special characters so it round-trips unchanged.
const NATIVE_CREDENTIAL_ITEM_TESTID = 'settings_passkeys_item_cred-123'

type AutofillMock = {
    isProviderActive: ReturnType<typeof vi.fn>
    getStoredCredentials: ReturnType<typeof vi.fn>
    openProviderSettings: ReturnType<typeof vi.fn>
}

const getAutofill = (): AutofillMock =>
    (getProvider() as unknown as { passkeyAutofill: AutofillMock })
        .passkeyAutofill

const wireAutofill = ({
    providerActive,
    credentials = [],
}: {
    providerActive: boolean
    credentials?: NativeStoredCredential[]
}) => {
    const a = getAutofill()
    a.isProviderActive.mockResolvedValue(providerActive)
    a.getStoredCredentials.mockResolvedValue(credentials)
    a.openProviderSettings.mockResolvedValue(false)
}

const seedHDWallet = () => useAccountsStore.getState().setAccounts([HD_ACCOUNT])

type BiometricLevel = 'none' | 'secret' | 'weak' | 'strong'

// The integration mock of the platform driver's `biometrics` service doesn't
// implement `getSecurityLevel` (it isn't needed by most flows), so the screen
// would otherwise read it as undefined → "not strong". Define it explicitly
// per scenario; beforeEach sets the strong default.
const setBiometricLevel = (level: BiometricLevel) => {
    ;(
        getProvider().biometrics as unknown as {
            getSecurityLevel: () => Promise<BiometricLevel>
        }
    ).getSecurityLevel = vi.fn().mockResolvedValue(level)
}

describe('Flow: Settings → Passkeys', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        // Default: a strong biometric is enrolled. Cases that need the
        // warning downgrade it explicitly.
        setBiometricLevel('strong')

        // The autofill service is a shared singleton across tests in this
        // file — reset its vi.fns and re-establish the default scenario
        // (provider off, no credentials) so each case starts clean.
        const a = getAutofill()
        a.isProviderActive.mockReset()
        a.getStoredCredentials.mockReset()
        a.openProviderSettings.mockReset()
        wireAutofill({ providerActive: false })
    })

    it(
        'Given Pera is not the active credential provider, when the screen mounts, then the disabled state is shown and no prerequisite notice appears',
        async () => {
            wireAutofill({ providerActive: false })

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_disabled_state'),
                ).toBeTruthy()
            })
            // Notices are gated to the managing (empty / populated) states —
            // never shown over the disabled state, even with no HD wallet.
            expect(
                screen.queryByTestId('settings_passkeys_hd_wallet_notice'),
            ).toBeFalsy()
            expect(
                screen.queryByTestId('settings_passkeys_biometric_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the provider is active with no passkeys and all prerequisites met, when the screen mounts, then the empty state is shown without any notice',
        async () => {
            wireAutofill({ providerActive: true })
            seedHDWallet()

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_empty_state'),
                ).toBeTruthy()
            })
            expect(
                screen.queryByTestId('settings_passkeys_hd_wallet_notice'),
            ).toBeFalsy()
            expect(
                screen.queryByTestId('settings_passkeys_biometric_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the provider is active but there is no HD wallet, when the screen mounts, then the empty state shows the universal-wallet-required notice',
        async () => {
            wireAutofill({ providerActive: true })
            // No HD wallet seeded.

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_hd_wallet_notice'),
                ).toBeTruthy()
            })
            expect(
                screen.getByTestId('settings_passkeys_empty_state'),
            ).toBeTruthy()
            // HD wallet is the more fundamental gap, so the screen-lock notice
            // is suppressed regardless of the device's authentication level.
            expect(
                screen.queryByTestId('settings_passkeys_biometric_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD wallet but no screen lock, when the screen mounts, then the empty state shows the screen-lock-required notice',
        async () => {
            wireAutofill({ providerActive: true })
            seedHDWallet()
            setBiometricLevel('none')

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_biometric_notice'),
                ).toBeTruthy()
            })
            expect(
                screen.getByTestId('settings_passkeys_empty_state'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('settings_passkeys_hd_wallet_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an HD wallet and only a device credential (no biometric), when the screen mounts, then no screen-lock notice appears',
        async () => {
            wireAutofill({ providerActive: true })
            seedHDWallet()
            setBiometricLevel('secret')

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_empty_state'),
                ).toBeTruthy()
            })
            expect(
                screen.queryByTestId('settings_passkeys_biometric_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a stored native credential, when the screen mounts, then the populated list renders the passkey with its display name and origin',
        async () => {
            wireAutofill({
                providerActive: true,
                credentials: [NATIVE_CREDENTIAL],
            })
            seedHDWallet()

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            await waitFor(() => {
                expect(
                    screen.getByTestId(NATIVE_CREDENTIAL_ITEM_TESTID),
                ).toBeTruthy()
            })
            expect(screen.getByText('Alice Example')).toBeTruthy()
            expect(screen.getByText('example.com')).toBeTruthy()
            // With credentials present, prerequisites are satisfied and no
            // notice should appear.
            expect(
                screen.queryByTestId('settings_passkeys_hd_wallet_notice'),
            ).toBeFalsy()
            expect(
                screen.queryByTestId('settings_passkeys_biometric_notice'),
            ).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the native credential lookup throws, when the screen mounts, then the failure is swallowed and the empty state is shown rather than an error',
        async () => {
            getAutofill().isProviderActive.mockResolvedValue(true)
            getAutofill().getStoredCredentials.mockRejectedValue(
                new Error('native identity store unavailable'),
            )
            seedHDWallet()

            renderWithNavigation(SettingsPasskeyScreen, 'SettingsPasskeys')

            // Reaching the empty state (rather than hanging in loading or
            // surfacing an error) is the proof: usePasskeysQuery catches the
            // native failure and falls back to "no native credentials".
            await waitFor(() => {
                expect(
                    screen.getByTestId('settings_passkeys_empty_state'),
                ).toBeTruthy()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
