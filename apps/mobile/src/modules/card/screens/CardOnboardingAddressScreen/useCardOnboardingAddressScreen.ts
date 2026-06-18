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

import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    addressSchema,
    useCardStore,
    useRegistrationSettingsQuery,
    useSubmitAddressMutation,
    useSubmitConsentMutation,
    type AddressFormValues,
    type AddressInput,
    type SupportedCountry,
    type SupportedUsState,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { CardUsStatePickerContent } from '@modules/card/components/CardUsStatePicker'
import { useWebView } from '@modules/webview'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Optional } from '@perawallet/wallet-core-shared'

/** ISO 3166-1 alpha-2 of the United States; the only jurisdiction needing a state. */
const US_ISO = 'US'

export type UseCardOnboardingAddressScreenResult = {
    control: Control<AddressFormValues>
    errors: FieldErrors<AddressFormValues>
    /** True when the address form is valid AND both T&C boxes are accepted. */
    isValid: boolean
    isSubmitting: boolean
    selectedCountry: Optional<SupportedCountry>
    isUsResident: boolean
    selectedUsState: Optional<SupportedUsState>
    allowMarketing: boolean
    cardTermsAccepted: boolean
    platformTermsAccepted: boolean
    handleSelectCountry: () => void
    handleSelectUsState: () => void
    handleToggleMarketing: () => void
    handleToggleCardTerms: () => void
    handleTogglePlatformTerms: () => void
    handleOpenCardTerms: () => void
    handleOpenPlatformTerms: () => void
    handleConfirm: () => void
}

export const useCardOnboardingAddressScreen =
    (): UseCardOnboardingAddressScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { request } = useBottomSheet()
        const { pushWebView } = useWebView()
        const onboardingId = useCardStore(state => state.onboardingId)
        const residenceCountryIso = useCardStore(state => state.countryIso)
        const setCountryIso = useCardStore(state => state.setCountryIso)
        const setAllowMarketing = useCardStore(state => state.setAllowMarketing)
        // The checkbox binds straight to the persisted preference so an
        // opt-out survives remounts and failed submits.
        const allowMarketing = useCardStore(state => state.allowMarketing)
        const submitAddress = useSubmitAddressMutation()
        const submitConsent = useSubmitConsentMutation()
        const { data: settings } = useRegistrationSettingsQuery()

        const [selectedCountry, setSelectedCountry] =
            useState<Optional<SupportedCountry>>(undefined)
        const [selectedUsState, setSelectedUsState] =
            useState<Optional<SupportedUsState>>(undefined)
        const [cardTermsAccepted, setCardTermsAccepted] = useState(false)
        const [platformTermsAccepted, setPlatformTermsAccepted] =
            useState(false)
        const hasPreselected = useRef(false)

        const {
            control,
            handleSubmit,
            setValue,
            watch,
            trigger,
            formState: { isValid: isFormValid, errors },
        } = useForm<AddressFormValues>({
            resolver: zodResolver(addressSchema),
            mode: 'onChange',
            defaultValues: {
                countryIso: '',
                addressLine1: '',
                addressLine2: '',
                city: '',
                zip: '',
                usState: '',
            },
        })

        const isUsResident = watch('countryIso') === US_ISO

        // Baanx Card-Issue T&C URL for the resident's jurisdiction (from
        // GET /v1/auth/settings); Pera's terms page is the fallback. Fully
        // optional-chained so a settings shape without the links block can't
        // crash the render.
        const cardTermsUrl =
            settings?.termsAndConditionsUrls?.[isUsResident ? 'us' : 'intl'] ??
            config.termsOfServiceUrl

        // Prefill the residence country chosen earlier in the flow, once settings
        // load. One-shot; matches it against the supported list for the flag/name.
        useEffect(() => {
            if (hasPreselected.current || selectedCountry) return
            if (!residenceCountryIso || !settings?.countries.length) return
            const match = settings.countries.find(
                country => country.iso3166alpha2 === residenceCountryIso,
            )
            if (!match) return
            hasPreselected.current = true
            setSelectedCountry(match)
            setValue('countryIso', match.iso3166alpha2, {
                shouldValidate: true,
            })
        }, [residenceCountryIso, settings, selectedCountry, setValue])

        // Surface the "state required" error as soon as a US residence is in
        // effect (preselected or picked) — validating only `countryIso` wouldn't
        // populate the cross-field `usState` issue. Picking a state clears it.
        useEffect(() => {
            if (isUsResident) void trigger('usState')
        }, [isUsResident, trigger])

        // TODO(card): confirm whether residence is editable here — Baanx already
        // received the country at email/verify, and this pick (even a
        // canSignUp:false country) only updates local state.
        const handleSelectCountry = useCallback(() => {
            const openPicker = async () => {
                const country = await request<SupportedCountry>({
                    contents: createElement(CardCountryPickerContent),
                    // The picker owns a scrollable list, so it manages its own
                    // layout — `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (!country) return
                setSelectedCountry(country)
                setValue('countryIso', country.iso3166alpha2, {
                    shouldValidate: true,
                })
                setCountryIso(country.iso3166alpha2)
                // Residence drives the state requirement — a country change
                // invalidates any previously picked state.
                setSelectedUsState(undefined)
                setValue('usState', '', { shouldValidate: true })
            }
            void openPicker()
        }, [request, setValue, setCountryIso])

        const handleSelectUsState = useCallback(() => {
            const openPicker = async () => {
                const usState = await request<SupportedUsState>({
                    contents: createElement(CardUsStatePickerContent),
                    // The picker owns a scrollable list, so it manages its own
                    // layout — `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (!usState) return
                setSelectedUsState(usState)
                setValue('usState', usState.postalAbbreviation, {
                    shouldValidate: true,
                })
            }
            void openPicker()
        }, [request, setValue])

        const handleToggleMarketing = useCallback(
            () => setAllowMarketing(!allowMarketing),
            [setAllowMarketing, allowMarketing],
        )
        const handleToggleCardTerms = useCallback(
            () => setCardTermsAccepted(previous => !previous),
            [],
        )
        const handleTogglePlatformTerms = useCallback(
            () => setPlatformTermsAccepted(previous => !previous),
            [],
        )

        const handleOpenCardTerms = useCallback(() => {
            pushWebView({ url: cardTermsUrl, id: 'card-terms' })
        }, [pushWebView, cardTermsUrl])
        const handleOpenPlatformTerms = useCallback(() => {
            // Checkbox 2 is Pera's own Terms & Conditions.
            pushWebView({ url: config.termsOfServiceUrl, id: 'platform-terms' })
        }, [pushWebView])

        const submitAddressForm = handleSubmit(async values => {
            // Set by email/verify; if missing, re-verify rather than submit an
            // empty onboarding id.
            if (onboardingId === null) {
                errorToast(
                    t('peraCard.address.error_title'),
                    t('peraCard.address.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            const address: AddressInput = {
                onboardingId,
                addressLine1: values.addressLine1,
                city: values.city,
                zip: values.zip,
                // No separate mailing address is collected; residence is used.
                isSameMailingAddress: true,
                ...(values.addressLine2
                    ? { addressLine2: values.addressLine2 }
                    : {}),
                ...(values.countryIso === US_ISO && values.usState
                    ? { usState: values.usState }
                    : {}),
            }
            try {
                // Record the user's consents (T&Cs + marketing) first, then
                // finalize registration with the address. Both T&Cs are
                // guaranteed accepted here — the Continue button gates on them.
                await submitConsent.mutateAsync({
                    onboardingId,
                    allowMarketing,
                    cardTermsAccepted,
                    platformTermsAccepted,
                })
                await submitAddress.mutateAsync(address)
                // The mutation's onSuccess commits the session and marks the
                // onboarding step Completed. Registration is done — hand back to
                // the setup checklist, where Connect Funds is now the live step.
                navigation.navigate('CardOnboardingStatus')
            } catch {
                errorToast(
                    t('peraCard.address.error_title'),
                    t('peraCard.address.error_body'),
                )
            }
        })

        const handleConfirm = () => {
            void submitAddressForm()
        }

        return {
            control,
            errors,
            isValid: isFormValid && cardTermsAccepted && platformTermsAccepted,
            isSubmitting: submitAddress.isPending || submitConsent.isPending,
            selectedCountry,
            isUsResident,
            selectedUsState,
            allowMarketing,
            cardTermsAccepted,
            platformTermsAccepted,
            handleSelectCountry,
            handleSelectUsState,
            handleToggleMarketing,
            handleToggleCardTerms,
            handleTogglePlatformTerms,
            handleOpenCardTerms,
            handleOpenPlatformTerms,
            handleConfirm,
        }
    }
