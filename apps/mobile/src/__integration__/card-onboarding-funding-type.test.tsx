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
import { http, HttpResponse } from 'msw'
import {
    FundingType,
    OnboardingStep,
    useCardStore,
} from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingStatusScreen } from '@modules/card/screens/CardOnboardingStatusScreen'

const FUNDING_ADDRESS =
    'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

// The setup checklist with a stub Home tab so the "Create Pera Card" terminus
// (navigate to TabBar → Home) resolves without a registered tab navigator.
const renderStatus = () =>
    renderWithNavigation(CardOnboardingStatusScreen, 'CardOnboardingStatus', {
        additionalScreens: [{ name: 'TabBar', component: () => null }],
    })

const mockOnboardingDetails = (verificationState: string) =>
    server.use(
        http.get('*/v1/auth/register', () =>
            HttpResponse.json(
                { id: 'mock-onboarding-id', verificationState },
                { status: 200 },
            ),
        ),
    )

describe('Flow: Card onboarding — select funding type', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        const store = useCardStore.getState()
        store.resetState()
        store.setOnboardingId('mock-onboarding-id')
        // Registration done + a funding source linked → the funding-type step
        // is the active (final) one.
        store.setOnboardingStep(OnboardingStep.Completed)
        store.setConnectedFundingSourceAddress(FUNDING_ADDRESS)
        mockOnboardingDetails('VERIFIED')
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given funds are connected, then both funding-type options and the Create button show', async () => {
        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-funding-type-auto'),
            ).toBeTruthy(),
        )
        expect(
            screen.getByTestId('card-onboarding-status-funding-type-manual'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card-onboarding-status-create-card'),
        ).toBeTruthy()
    })

    it('Given Manual is picked, when Create Pera Card is pressed, then the choice is persisted', async () => {
        renderStatus()

        fireEvent.click(
            await screen.findByTestId(
                'card-onboarding-status-funding-type-manual',
            ),
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-status-create-card'),
        )

        await waitFor(() =>
            expect(useCardStore.getState().selectedFundingType).toBe(
                FundingType.Manual,
            ),
        )
    })

    it('Given funds are not connected, then the funding-type row stays inactive with no Create button', async () => {
        useCardStore.getState().setConnectedFundingSourceAddress(null)

        renderStatus()

        // findBy flushes the in-flight onboarding-details poll so its state
        // update lands inside act() rather than after teardown.
        expect(
            await screen.findByTestId('card-onboarding-status-funding-type'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('card-onboarding-status-funding-type-auto'),
        ).toBeNull()
        expect(
            screen.queryByTestId('card-onboarding-status-create-card'),
        ).toBeNull()
    })
})
