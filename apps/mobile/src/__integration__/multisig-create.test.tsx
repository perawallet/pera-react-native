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

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { mockCreateMultisigAccount } from '@perawallet/wallet-core-multisig/test-handlers'
import { CreateMultisigScreen } from '@modules/multisig/screens/CreateMultisigScreen/CreateMultisigScreen'
import { SetThresholdScreen } from '@modules/multisig/screens/SetThresholdScreen/SetThresholdScreen'
import { NameMultisigScreen } from '@modules/multisig/screens/NameMultisigScreen/NameMultisigScreen'
import { useMultisigCreationStore } from '@modules/multisig/hooks/useMultisigCreation'
import {
    useAccountsStore,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceStore } from '@perawallet/wallet-core-device'

import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

// Adding participants in-app runs through the AddParticipantContent bottom
// sheet (NFD search / contact picker), which is out of scope here; the
// participants are seeded into the creation store directly so this test can
// focus on the threshold and "before you create" gate steps that the
// import-flow test (which builds from a scanned payload) does not exercise.
const PARTICIPANTS = [
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
]

// Navigation transitions plus the bottom-sheet open/resolve cycle push the
// wall-clock past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Create a multisig account from scratch', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useMultisigCreationStore.getState().resetState()
        PARTICIPANTS.forEach(address =>
            useMultisigCreationStore.getState().addParticipant({ address }),
        )
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('mainnet', 'test-device-id')
        useDeviceStore.getState().setDeviceID('testnet', 'test-device-id')
    })

    it(
        'Given participants, when the user proceeds and raises the threshold to the participant count, then the threshold is committed and the warning gate hands off to the naming screen',
        async () => {
            renderWithNavigation(CreateMultisigScreen, 'CreateMultisig', {
                additionalScreens: [
                    { name: 'SetThreshold', component: SetThresholdScreen },
                    { name: 'NameMultisig', component: NameMultisigScreen },
                ],
            })

            // Seeded participants unlock "Continue" (the gate is >= 2).
            await waitFor(() =>
                expect(
                    screen.getByTestId('create_multisig_continue_button'),
                ).toBeTruthy(),
            )
            fireEvent.click(
                screen.getByTestId('create_multisig_continue_button'),
            )

            // Threshold screen starts at the store default of 2; the stepper
            // caps at the participant count (3), so two increments only raise
            // it to 3 and the third is a no-op.
            await waitFor(() =>
                expect(screen.getByTestId('threshold_value')).toBeTruthy(),
            )
            fireEvent.click(screen.getByTestId('threshold_increment_button'))
            fireEvent.click(screen.getByTestId('threshold_increment_button'))
            expect(useMultisigCreationStore.getState().threshold).toBe(3)

            fireEvent.click(screen.getByTestId('set_threshold_continue_button'))

            // The "before you create" warning sheet gates the naming step.
            await waitFor(() =>
                expect(
                    screen.getByTestId('before_create_proceed_button'),
                ).toBeTruthy(),
            )
            fireEvent.click(screen.getByTestId('before_create_proceed_button'))

            // Confirming the gate reaches the naming screen with the creation
            // store still carrying the participants and committed threshold.
            await waitFor(() =>
                expect(
                    screen.getByTestId('name_account_finish_button'),
                ).toBeTruthy(),
            )
            const state = useMultisigCreationStore.getState()
            expect(state.threshold).toBe(3)
            expect(state.participants.map(p => p.address)).toEqual(PARTICIPANTS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given seeded participants, when the user completes threshold → naming → finish, then a brand-new multisig account is created (not the import branch) and selected',
        async () => {
            // The create flow navigates to NameMultisig without route params,
            // so useNameMultisigScreen takes the from-scratch branch (reads the
            // creation store) rather than the import branch. The backend create
            // call must succeed for the account to persist.
            server.use(
                mockCreateMultisigAccount({
                    response: {
                        custom_id: 'joint-create-1',
                        creation_datetime: '2024-01-01T00:00:00Z',
                        address: ALGO25_TEST_ADDRESS,
                        version: 1,
                        threshold: 2,
                        participant_addresses: PARTICIPANTS,
                    },
                }),
            )

            renderWithNavigation(CreateMultisigScreen, 'CreateMultisig', {
                additionalScreens: [
                    { name: 'SetThreshold', component: SetThresholdScreen },
                    { name: 'NameMultisig', component: NameMultisigScreen },
                    // exitAccountFlow resets to 'TabBar' once creation finishes.
                    {
                        name: 'TabBar',
                        component: () => <View testID='create-flow-home' />,
                    },
                ],
            })

            await waitFor(() =>
                screen.getByTestId('create_multisig_continue_button'),
            )
            fireEvent.click(
                screen.getByTestId('create_multisig_continue_button'),
            )

            await waitFor(() =>
                screen.getByTestId('set_threshold_continue_button'),
            )
            fireEvent.click(screen.getByTestId('set_threshold_continue_button'))

            await waitFor(() =>
                screen.getByTestId('before_create_proceed_button'),
            )
            fireEvent.click(screen.getByTestId('before_create_proceed_button'))

            await waitFor(() =>
                screen.getByTestId('name_account_finish_button'),
            )
            fireEvent.change(screen.getByTestId('name_account_name_input'), {
                target: { value: 'Team treasury' },
            })
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            await waitFor(() =>
                expect(useAccountsStore.getState().accounts).toHaveLength(1),
            )
            const saved = useAccountsStore.getState()
                .accounts[0] as MultiSigAccount
            expect(saved.type).toBe('multisig')
            expect(saved.name).toBe('Team treasury')
            expect(saved.multisigDetails).toEqual({
                threshold: 2,
                addresses: PARTICIPANTS,
                version: 1,
            })
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                saved.address,
            )

            await waitFor(() => screen.getByTestId('create-flow-home'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it('Given fewer than two participants, when the create screen renders, then Continue is disabled', async () => {
        useMultisigCreationStore.getState().resetState()
        useMultisigCreationStore
            .getState()
            .addParticipant({ address: ALGO25_TEST_ADDRESS })

        renderWithNavigation(CreateMultisigScreen, 'CreateMultisig')

        const continueButton = await screen.findByTestId(
            'create_multisig_continue_button',
        )
        expect((continueButton as HTMLButtonElement).disabled).toBe(true)
    })
})
