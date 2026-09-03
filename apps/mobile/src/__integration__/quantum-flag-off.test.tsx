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

// Rollout-safety proof: with `enable_quantum_accounts` OFF (the default in the
// vitest env), neither account-adding surface exposes a Quantum entrypoint.
// This is the "flag off → nothing changes" counterpart to the flag-on flows in
// onboarding-import-quantum.test.tsx and the AddAccountScreen quantum-create
// option covered by useAddAccountScreen.spec.ts.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { renderHook, screen } from '@testing-library/react'

import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'

describe('quantum flag off', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => {
        server.resetHandlers()
        // Flag is off by default in this env, but guard against leakage from
        // other suites that override it via the remote-config store.
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(() => server.close())

    it('does not render the quantum create option on the Add Account screen', () => {
        expect(
            renderHook(() => useIsQuantumAccountsEnabled()).result.current,
        ).toBe(false)

        renderWithNavigation(AddAccountScreen, 'AddAccountHome')

        // Positive control: a standard, non-quantum option still renders so
        // the absence assertion below is meaningful (the screen isn't just
        // empty/broken).
        expect(
            screen.getByTestId('add_account_create_multisig_button'),
        ).toBeTruthy()

        expect(
            screen.queryByTestId('add_account_create_quantum_button'),
        ).toBeNull()
    })

    it('does not render the quantum import entry on the Import Account Options screen', () => {
        renderWithNavigation(ImportAccountOptionsScreen, 'ImportAccountOptions')

        // Positive control: the standard "recover a wallet" option still
        // renders so the absence assertion below is meaningful.
        expect(
            screen.getByTestId('import_account_options_recover_wallet_button'),
        ).toBeTruthy()

        expect(screen.queryByTestId('import_account_quantum_button')).toBeNull()
    })
})
