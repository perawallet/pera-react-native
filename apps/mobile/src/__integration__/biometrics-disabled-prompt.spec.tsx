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

// The "biometrics turned off" prompt asks for the PIN before re-opting in. It
// does so inline because a prompt on screen holds bottom-sheet presentation,
// so a PIN sheet requested from it would never paint.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'
import { renderHook } from '@testing-library/react'

import { act, fireEvent, render, screen, waitFor } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { usePinCode, useSecurityStore } from '@perawallet/wallet-core-security'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { usePromptStore } from '@modules/prompts/store'

const TEST_PIN = '123456'
const TEST_TOKEN = new Uint8Array([1, 2, 3, 4])

vi.mock('@modules/onboarding/hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => ({
        currentVersion: '2',
        needsAcceptance: false,
        acceptCurrentTerms: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useHasAccounts: () => true,
}))

// Every other nudge reads as already handled, so the biometrics prompt is the
// only one due.
vi.mock('@perawallet/wallet-core-settings', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-settings')
    >()),
    usePreferences: () => ({
        getPreference: () => true,
        setPreference: vi.fn(),
    }),
    useAnalyticsConsent: () => ({ consent: 'granted', setConsent: vi.fn() }),
}))

import { PromptContainer } from '@modules/prompts'

const sha256Hex = (bytes: Uint8Array): string =>
    bytesToHex(new Uint8Array(createHash('sha256').update(bytes).digest()))

const wireBiometrics = () => {
    const biometrics = getProvider().biometrics as unknown as Record<
        string,
        ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>
    >
    biometrics.checkBiometricsAvailable.mockResolvedValue(true)
    biometrics.getSecurityLevel.mockResolvedValue('strong')
    biometrics.checkEnrollmentBinding.mockResolvedValue('valid')
    biometrics.armBiometricBinding.mockResolvedValue({
        blob: 'test-ciphertext',
        tokenHash: sha256Hex(TEST_TOKEN),
    })
    biometrics.unwrapBiometricToken.mockImplementation(async () => ({
        success: true,
        token: Uint8Array.from(TEST_TOKEN),
    }))
    return biometrics
}

const seedPin = async (): Promise<void> => {
    const { result } = renderHook(() => usePinCode())
    await act(async () => {
        await result.current.savePin(TEST_PIN)
    })
}

const enterPin = async (pin: string): Promise<void> => {
    await waitFor(() => expect(screen.getByTestId('numpad_key_0')).toBeTruthy())
    for (const digit of pin) {
        await act(async () => {
            fireEvent.click(screen.getByTestId(`numpad_key_${digit}`))
        })
    }
}

describe('Flow: re-enabling biometrics from the prompt', () => {
    let biometrics: ReturnType<typeof wireBiometrics>

    beforeEach(async () => {
        resetTestKeystore()
        vi.clearAllMocks()
        biometrics = wireBiometrics()
        await seedPin()
        act(() => {
            usePromptStore.getState().markEntryDelayPaid()
            useSecurityStore
                .getState()
                .setBiometricsDisabledReason('enrollment-changed')
        })
    })

    afterEach(() => {
        act(() => {
            usePromptStore.getState().resetState()
            useBottomSheetStore.getState().resetState()
            useSecurityStore.getState().resetState()
        })
        resetTestKeystore()
    })

    it('Given the prompt is up, when the user taps Enable, then the PIN is asked for in the prompt and biometrics turn on only after it', async () => {
        render(<PromptContainer />)
        fireEvent.click(
            await screen.findByTestId(
                'biometrics_disabled_prompt_enable_button',
            ),
        )

        expect(
            await screen.findByTestId('biometrics_disabled_prompt_pin'),
        ).toBeTruthy()
        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)
        expect(biometrics.armBiometricBinding).not.toHaveBeenCalled()

        await enterPin(TEST_PIN)

        await waitFor(() =>
            expect(useSecurityStore.getState().isBiometricsEnabled).toBe(true),
        )
        await waitFor(() =>
            expect(
                screen.queryByTestId('biometrics_disabled_prompt'),
            ).toBeNull(),
        )
    })

    it('Given the PIN step is open, when the user closes it, then biometrics stay off and the offer is still there', async () => {
        render(<PromptContainer />)
        fireEvent.click(
            await screen.findByTestId(
                'biometrics_disabled_prompt_enable_button',
            ),
        )
        fireEvent.click(
            await screen.findByTestId('biometrics_disabled_prompt_pin_close'),
        )

        expect(
            await screen.findByTestId(
                'biometrics_disabled_prompt_enable_button',
            ),
        ).toBeTruthy()
        expect(biometrics.armBiometricBinding).not.toHaveBeenCalled()
        expect(useSecurityStore.getState().biometricsDisabledReason).toBe(
            'enrollment-changed',
        )
    })

    it('Given the PIN step is open, when a wrong PIN is entered, then biometrics stay off', async () => {
        render(<PromptContainer />)
        fireEvent.click(
            await screen.findByTestId(
                'biometrics_disabled_prompt_enable_button',
            ),
        )

        await enterPin('999999')

        expect(
            screen.getByTestId('biometrics_disabled_prompt_pin'),
        ).toBeTruthy()
        expect(biometrics.armBiometricBinding).not.toHaveBeenCalled()
        expect(useSecurityStore.getState().isBiometricsEnabled).toBe(false)
    })
})
