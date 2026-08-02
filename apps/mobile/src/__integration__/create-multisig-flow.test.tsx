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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { View } from 'react-native'

import { http, HttpResponse, server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { CreateMultisigScreen } from '@modules/multisig/screens/CreateMultisigScreen/CreateMultisigScreen'
import { SetThresholdScreen } from '@modules/multisig/screens/SetThresholdScreen/SetThresholdScreen'
import { NameMultisigScreen } from '@modules/multisig/screens/NameMultisigScreen/NameMultisigScreen'
import { useMultisigCreationStore } from '@modules/multisig/hooks/useMultisigCreation'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import {
    useAccountsStore,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'

import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

// The store is the flow's source of truth — `NameMultisig` reads participants
// and threshold from it, never from route params — so it's seeded directly,
// since the AddParticipant sheet drives a full AddressSearchView that's
// impractical under jsdom. Every other step runs through the real screens.
//
// `generateMultisigAddress` runs for real and rejects non-base32 input, so
// participants must be real addresses and the expected multisig address is
// derived the same way the screen derives it.
const VERSION = 1

const seedParticipants = (addresses: string[]) => {
    const store = useMultisigCreationStore.getState()
    addresses.forEach(address => store.addParticipant({ address }))
}

// Navigation transitions plus a `requestAnimationFrame` inside `handleFinish`
// push the wall-clock past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Create a multisig account from scratch', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useMultisigCreationStore.getState().resetState()
        useOnboardingStore.getState().reset()
        // `handleFinish` bails out early without a device ID. Seed both
        // networks so the test doesn't depend on the harness default.
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('mainnet', 'test-device-id')
        useDeviceStore.getState().setDeviceID('testnet', 'test-device-id')
    })

    it(
        'Given seeded participants, when the user advances from the create screen through the threshold step and confirms the info sheet, then the flow reaches the naming screen',
        async () => {
            seedParticipants([ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS])

            renderWithNavigation(CreateMultisigScreen, 'CreateMultisig', {
                additionalScreens: [
                    { name: 'SetThreshold', component: SetThresholdScreen },
                    { name: 'NameMultisig', component: NameMultisigScreen },
                ],
            })

            // Two participants seeded → continue is enabled; advance to the
            // threshold screen.
            const continueButton = screen.getByTestId(
                'create_multisig_continue_button',
            ) as HTMLButtonElement
            expect(continueButton.disabled).toBe(false)
            fireEvent.click(continueButton)

            await waitFor(() =>
                screen.getByTestId('set_threshold_continue_button'),
            )
            // The threshold screen mirrors the seeded participant count.
            expect(
                screen.getByTestId('participant_count_value').textContent,
            ).toContain('2')

            // Continue opens the "Before you create" info sheet; proceeding
            // hands off to the naming screen.
            fireEvent.click(screen.getByTestId('set_threshold_continue_button'))
            await waitFor(() =>
                screen.getByTestId('before_create_proceed_button'),
            )
            fireEvent.click(screen.getByTestId('before_create_proceed_button'))

            await waitFor(() =>
                expect(
                    screen.getByTestId('name_account_finish_button'),
                ).toBeTruthy(),
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a built multisig composition, when the user names the account and finishes, then the create mutation fires and a multisig account is persisted and selected',
        async () => {
            const addresses = [ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS]
            const threshold = 2
            const expectedAddress = generateMultisigAddress(
                VERSION,
                threshold,
                addresses,
            )
            seedParticipants(addresses)

            const response = {
                custom_id: 'created-1',
                creation_datetime: '2024-01-01T00:00:00Z',
                address: expectedAddress,
                version: VERSION,
                threshold,
                participant_addresses: addresses,
            }
            // A recording handler (cleared by `server.resetHandlers()` in
            // afterEach) captures the POST body to prove the create mutation
            // actually fired with the built composition — not just that some
            // request landed.
            let createBody: Record<string, unknown> | undefined
            server.use(
                http.post(
                    '*/v1/joint-accounts/accounts/',
                    async ({ request }) => {
                        createBody = (await request.json()) as Record<
                            string,
                            unknown
                        >
                        return HttpResponse.json(response, { status: 200 })
                    },
                ),
            )

            // The production create flow pushes `NameMultisig` with no params,
            // so the screen sources the composition from the creation store. The
            // integration test navigator coerces an absent params object to `{}`
            // (truthy), which steers `useNameMultisigScreen` into its
            // imported-account branch and reads `addresses` off the params —
            // unreachable for the store path through navigation. We therefore
            // enter `NameMultisig` directly with params mirroring exactly what
            // the user built (the seeded participants + chosen threshold +
            // version 1). `handleFinish`'s persist logic is identical either
            // way, so this faithfully exercises derivation, the create mutation,
            // and the account write.
            renderWithNavigation(NameMultisigScreen, 'NameMultisig', {
                initialParams: {
                    address: expectedAddress,
                    threshold,
                    addresses,
                    version: VERSION,
                },
                additionalScreens: [
                    // exitAccountFlow resets to 'TabBar' after finishing — a
                    // stub gives the reset a real, observable target.
                    {
                        name: 'TabBar',
                        component: () => <View testID='create-flow-home' />,
                    },
                ],
            })

            await waitFor(() =>
                screen.getByTestId('name_account_finish_button'),
            )

            // Name the account and finish.
            fireEvent.change(screen.getByTestId('name_account_name_input'), {
                target: { value: 'Ops treasury' },
            })
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            // The create mutation fired with the built composition.
            await waitFor(() => expect(createBody).toBeDefined())
            expect(createBody).toMatchObject({
                version: VERSION,
                threshold,
                participant_addresses: addresses,
                device_id: 'test-device-id',
            })

            // A multisig account is persisted with the derived address and
            // selected.
            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            const saved = useAccountsStore.getState().accounts[0]
            expect(saved.type).toBe('multisig')
            expect(saved.address).toBe(expectedAddress)
            expect(saved.name).toBe('Ops treasury')
            expect((saved as MultiSigAccount).multisigDetails).toEqual({
                threshold,
                addresses,
                version: VERSION,
            })
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                expectedAddress,
            )

            // Finishing resets the navigator onto the wallet home stub.
            await waitFor(() => screen.getByTestId('create-flow-home'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given three participants, when the user uses the threshold stepper, then it floors at 1 and ceils at the participant count',
        async () => {
            seedParticipants([
                ALGO25_TEST_ADDRESS,
                HD_TEST_ADDRESS,
                REKEY_TARGET_ADDRESS,
            ])

            renderWithNavigation(SetThresholdScreen, 'SetThreshold')

            await waitFor(() =>
                screen.getByTestId('set_threshold_continue_button'),
            )
            // The store seeds threshold at 2 by default.
            expect(useMultisigCreationStore.getState().threshold).toBe(2)

            const decrement = screen.getByTestId(
                'threshold_decrement_button',
            ) as HTMLButtonElement
            const increment = screen.getByTestId(
                'threshold_increment_button',
            ) as HTMLButtonElement

            // Decrement floors at 1: stepping down past the minimum is a
            // no-op and the control disables itself.
            fireEvent.click(decrement)
            await waitFor(() =>
                expect(useMultisigCreationStore.getState().threshold).toBe(1),
            )
            expect(decrement.disabled).toBe(true)
            fireEvent.click(decrement)
            expect(useMultisigCreationStore.getState().threshold).toBe(1)

            // Increment ceils at the participant count (3).
            fireEvent.click(increment)
            fireEvent.click(increment)
            await waitFor(() =>
                expect(useMultisigCreationStore.getState().threshold).toBe(3),
            )
            expect(increment.disabled).toBe(true)
            fireEvent.click(increment)
            expect(useMultisigCreationStore.getState().threshold).toBe(3)

            expect(screen.getByTestId('threshold_value').textContent).toContain(
                '3',
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given fewer than two participants, when on the create screen, then continue is blocked until a second participant exists',
        async () => {
            seedParticipants([ALGO25_TEST_ADDRESS])

            renderWithNavigation(CreateMultisigScreen, 'CreateMultisig', {
                additionalScreens: [
                    {
                        name: 'SetThreshold',
                        component: () => (
                            <View testID='reached-set-threshold' />
                        ),
                    },
                ],
            })

            // One participant: continue is disabled and tapping it does not
            // advance the flow.
            const continueButton = screen.getByTestId(
                'create_multisig_continue_button',
            ) as HTMLButtonElement
            expect(continueButton.disabled).toBe(true)
            fireEvent.click(continueButton)
            expect(screen.queryByTestId('reached-set-threshold')).toBeNull()

            // Adding a second participant enables continue and navigates to
            // the threshold step.
            useMultisigCreationStore
                .getState()
                .addParticipant({ address: HD_TEST_ADDRESS })

            await waitFor(() =>
                expect(
                    (
                        screen.getByTestId(
                            'create_multisig_continue_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false),
            )
            fireEvent.click(
                screen.getByTestId('create_multisig_continue_button'),
            )
            await waitFor(() => screen.getByTestId('reached-set-threshold'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
