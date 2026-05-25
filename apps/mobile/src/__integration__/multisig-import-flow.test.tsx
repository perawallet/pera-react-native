/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { ImportSharedAccountScreen } from '@modules/multisig/screens/ImportSharedAccountScreen/ImportSharedAccountScreen'
import { NameMultisigScreen } from '@modules/multisig/screens/NameMultisigScreen/NameMultisigScreen'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import {
    useAccountsStore,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'
import {
    mockCreateMultisigAccount,
    mockDeleteMultisigImportInbox,
    mockGetMultisigAccountDetail,
} from '@perawallet/wallet-core-multisig/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

// Deeplink parsing (perawallet://app/shared-account-import/?address=X and the
// joint-account-import alias) is unit-tested in
// src/hooks/deeplink/__tests__/new-parser.test.ts. This flow test starts at
// the screen the deeplink navigates to.

// `generateMultisigAddress` runs for real here and rejects non-base32 input,
// so the participants must be real Algorand addresses. The shared address is
// derived from them: `useNameMultisigScreen` re-derives and verifies it
// before persisting, so the backend response and the derivation must agree
// by construction.
const PARTICIPANTS = [
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
]
const VERSION = 1
const THRESHOLD = 2
const SHARED_ADDRESS = generateMultisigAddress(VERSION, THRESHOLD, PARTICIPANTS)

const ACCOUNT_DETAIL_RESPONSE = {
    custom_id: 'joint-1',
    creation_datetime: '2024-01-01T00:00:00Z',
    address: SHARED_ADDRESS,
    version: VERSION,
    threshold: THRESHOLD,
    participant_addresses: PARTICIPANTS,
}

// Navigation transitions plus a `requestAnimationFrame` inside `handleFinish`
// push the wall-clock past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30000

describe('Flow: Import shared account by scanning its QR code', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        // `handleFinish` bails out early without a device ID. Seed both
        // networks so the test doesn't depend on the harness default.
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('mainnet', 'test-device-id')
        useDeviceStore.getState().setDeviceID('testnet', 'test-device-id')
    })

    it(
        'Given a scanned shared-account address, when the user reviews the preview and finishes naming, then a multisig account is persisted and selected',
        async () => {
            server.use(
                mockGetMultisigAccountDetail({
                    address: SHARED_ADDRESS,
                    response: ACCOUNT_DETAIL_RESPONSE,
                }),
                mockCreateMultisigAccount({
                    response: ACCOUNT_DETAIL_RESPONSE,
                }),
                // "Add to Accounts" fires a fire-and-forget inbox-invitation
                // delete, like Android — handle it so MSW stays quiet.
                mockDeleteMultisigImportInbox({
                    deviceId: 'test-device-id',
                    multisigAddress: SHARED_ADDRESS,
                }),
            )

            renderWithNavigation(
                ImportSharedAccountScreen,
                'ImportSharedAccount',
                {
                    initialParams: { address: SHARED_ADDRESS },
                    additionalScreens: [
                        { name: 'NameMultisig', component: NameMultisigScreen },
                        // exitAccountFlow resets to 'TabBar' after finishing
                        // — a stub gives the reset a real, observable target.
                        {
                            name: 'TabBar',
                            component: () => <View testID='import-flow-home' />,
                        },
                    ],
                },
            )

            // The preview renders once the backend lookup resolves: the
            // threshold, every participant row, and both footer actions.
            await waitFor(() =>
                screen.getByTestId('import-shared-account-add-button'),
            )
            expect(
                screen.getByTestId('import-shared-account-threshold'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('import-shared-account-ignore-button'),
            ).toBeTruthy()
            PARTICIPANTS.forEach(participant => {
                expect(
                    screen.getByTestId(`import-participant-row-${participant}`),
                ).toBeTruthy()
            })

            // "Add to Accounts" hands off to the naming screen.
            fireEvent.click(
                screen.getByTestId('import-shared-account-add-button'),
            )
            await waitFor(() =>
                screen.getByTestId('name_account_finish_button'),
            )

            // Name the account and finish.
            fireEvent.change(screen.getByTestId('name_account_name_input'), {
                target: { value: 'Team treasury' },
            })
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            // The multisig account is persisted — with the verified address —
            // and selected.
            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            const saved = useAccountsStore.getState().accounts[0]
            expect(saved.type).toBe('multisig')
            expect(saved.address).toBe(SHARED_ADDRESS)
            expect(saved.name).toBe('Team treasury')
            expect((saved as MultiSigAccount).multisigDetails).toEqual({
                threshold: THRESHOLD,
                addresses: PARTICIPANTS,
                version: 1,
            })
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                SHARED_ADDRESS,
            )

            // Finishing navigates away from the flow — the reset lands on
            // the wallet home (the stub TabBar route).
            await waitFor(() => screen.getByTestId('import-flow-home'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
