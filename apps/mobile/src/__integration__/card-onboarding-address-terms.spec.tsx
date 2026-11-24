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

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { http, HttpResponse } from 'msw'
import { clearCardSession, useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { CardOnboardingAddressScreen } from '@modules/card/screens/CardOnboardingAddressScreen'
import { useWebViewStore } from '@modules/webview'

const CARD_TERMS_TEXT = 'I accept the Card Issue '
const PLATFORM_TERMS_TEXT = "I accept Pera's "

const SETTINGS_RESPONSE = {
    countries: [
        {
            id: 'gb',
            iso3166alpha2: 'GB',
            name: 'United Kingdom',
            callingCode: '44',
            canSignUp: true,
        },
    ],
    usStates: [],
    links: {
        us: { termsAndConditions: 'https://baanx/us-terms.pdf' },
        intl: { termsAndConditions: 'https://baanx/intl-terms.pdf' },
    },
}

const fillAddressFields = () => {
    fireEvent.change(screen.getByTestId('card-onboarding-address-city-input'), {
        target: { value: 'Sheffield' },
    })
    fireEvent.change(screen.getByTestId('card-onboarding-address-zip-input'), {
        target: { value: 'S17 3RA' },
    })
    fireEvent.change(
        screen.getByTestId('card-onboarding-address-line1-input'),
        { target: { value: '3 Ryecroft Glen Road' } },
    )
}

const confirmButton = () =>
    screen.getByTestId('card-onboarding-address-confirm')

// The label's own text, outside the inline link.
const labelText = (prefix: string) => screen.getByText(new RegExp(`^${prefix}`))

describe('Flow: Card onboarding address, terms checkboxes with inline links', () => {
    beforeAll(async () => {
        // The harness runs without an i18n instance, so <Trans> renders
        // nothing and the inline links never mount. Give it the two labels.
        await i18next.use(initReactI18next).init({
            lng: 'en',
            resources: {
                en: {
                    translation: {
                        peraCard: {
                            address: {
                                card_terms: `${CARD_TERMS_TEXT}<0>Terms & Conditions</0>.`,
                                platform_terms: `${PLATFORM_TERMS_TEXT}<0>Terms & Conditions</0>.`,
                            },
                        },
                    },
                },
            },
        })
    })

    beforeEach(async () => {
        await clearCardSession()
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('john@example.com')
        store.setCountryIso('GB')
        store.setOnboardingId('mock-onboarding-id')
        store.setAllowMarketing(true)
        store.setAllowSms(true)
        useWebViewStore.getState().clearWebViews()
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
        )
    })

    it('Given a valid address, when each terms label is pressed outside its link, then both boxes tick and Continue enables', async () => {
        renderWithNavigation(
            CardOnboardingAddressScreen,
            'CardOnboardingAddress',
        )
        fillAddressFields()
        expect(isElementDisabled(confirmButton())).toBe(true)

        fireEvent.click(labelText(CARD_TERMS_TEXT))
        fireEvent.click(labelText(PLATFORM_TERMS_TEXT))

        await waitFor(() =>
            expect(isElementDisabled(confirmButton())).toBe(false),
        )
    })

    it('Given a valid address, when the inline Terms link is pressed, then the terms open and the box stays unticked', async () => {
        renderWithNavigation(
            CardOnboardingAddressScreen,
            'CardOnboardingAddress',
        )
        fillAddressFields()
        fireEvent.click(labelText(PLATFORM_TERMS_TEXT))

        fireEvent.click(
            await screen.findByTestId(
                'card-onboarding-address-card-terms-link',
            ),
        )

        await waitFor(() =>
            expect(
                useWebViewStore.getState().openWebViews.map(view => view.id),
            ).toContain('card-terms'),
        )
        // Only the platform terms are ticked, so Continue stays gated.
        expect(isElementDisabled(confirmButton())).toBe(true)
    })

    it('Given the terms rows, then each box is a checkbox named by its sentence and each inline link is its own link', async () => {
        renderWithNavigation(
            CardOnboardingAddressScreen,
            'CardOnboardingAddress',
        )
        const cardTermsCheckbox = () =>
            screen.getByRole('checkbox', {
                name: `${CARD_TERMS_TEXT}Terms & Conditions.`,
            })

        expect(
            (
                await screen.findAllByRole('link', {
                    name: 'Terms & Conditions',
                })
            ).length,
        ).toBe(2)
        expect(cardTermsCheckbox().getAttribute('aria-checked')).toBe('false')

        fireEvent.click(labelText(CARD_TERMS_TEXT))

        await waitFor(() =>
            expect(cardTermsCheckbox().getAttribute('aria-checked')).toBe(
                'true',
            ),
        )
    })
})
