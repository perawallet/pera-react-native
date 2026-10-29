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

import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    addressSchema,
    getCardApiError,
    isDuplicateError,
    isOnboardingNotFoundError,
    getCardOnboardingProgress,
    isUserAlreadyCreatedError,
    OnboardingStep,
    US_ISO,
    useCardStore,
    useOnboardingDetailsQuery,
    useRegistrationSettingsQuery,
    useSubmitAddressMutation,
    useSubmitConsentMutation,
    type AddressFormValues,
    type AddressInput,
    type SupportedCountry,
    type SupportedUsState,
} from '@perawallet/wallet-core-card'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, CardEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { CardUsStatePickerContent } from '@modules/card/components/CardUsStatePicker'
import { useCardErrorToast, useCardOnboardingRouter } from '@modules/card/hooks'
import {
    toValidatedBrowserUrl,
    useWebView,
    withLanguageParam,
} from '@modules/webview'
import { routeCapabilities } from '@routes/capabilities'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Optional } from '@perawallet/wallet-core-shared'
import { useCardScope } from '../../hooks/useCardScope'

export type UseCardOnboardingAddressScreenResult = {
    control: Control<AddressFormValues>
    errors: FieldErrors<AddressFormValues>
    /** True when the address form is valid AND both T&C boxes are accepted. */
    isValid: boolean
    isSubmitting: boolean
    selectedCountry: Optional<SupportedCountry>
    /** Display-only once the residence from the email step is known. */
    isCountryLocked: boolean
    isUsResident: boolean
    selectedUsState: Optional<SupportedUsState>
    /** US residents only: unticked means a separate mailing address follows. */
    isSameMailingAddress: boolean
    handleToggleSameMailingAddress: () => void
    cardTermsAccepted: boolean
    platformTermsAccepted: boolean
    /**
     * True when the marketing/SMS consents were never asked this session (a
     * resumed sign-in skipped the Set-Password screen) — the screen re-collects
     * them here so the consent set records the user's real choice.
     */
    showsConsentOptIns: boolean
    allowMarketing: boolean
    allowSms: boolean
    handleToggleMarketing: () => void
    handleToggleSms: () => void
    handleSelectCountry: () => void
    handleSelectUsState: () => void
    handleToggleCardTerms: () => void
    handleTogglePlatformTerms: () => void
    handleOpenCardTerms: () => void
    handleOpenPlatformTerms: () => void
    handleConfirm: () => void
}

export const useCardOnboardingAddressScreen =
    (): UseCardOnboardingAddressScreenResult => {
        const scope = useCardScope()
        const { t, currentLanguage } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast, infoToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: i18nKey('peraCard.address.error_title'),
            bodyKey: i18nKey('peraCard.address.error_body'),
        })
        const { goToNextStep } = useCardOnboardingRouter()
        const { request } = useBottomSheet()
        const { pushWebView } = useWebView()
        const onboardingId = useCardStore(state => state.onboardingId)

        const residenceCountryIso = useCardStore(state => state.countryIso)
        const setCountryIso = useCardStore(state => state.setCountryIso)
        // Marketing/SMS consents are captured on the Set-Password screen; read
        // them here to submit with the granular /v2/consent set on this step.
        const allowMarketing = useCardStore(state => state.allowMarketing)
        const allowSms = useCardStore(state => state.allowSms)
        const setAllowMarketing = useCardStore(state => state.setAllowMarketing)
        const setAllowSms = useCardStore(state => state.setAllowSms)
        // Snapshot on mount: null means the Set-Password screen never ran this
        // session (resumed sign-in), so the consents must be re-collected here
        // instead of silently recorded as "denied". Snapshotted so the boxes
        // don't vanish mid-interaction once the first tick makes them non-null.
        const [showsConsentOptIns] = useState(
            () => allowMarketing === null || allowSms === null,
        )
        const submitAddress = useSubmitAddressMutation(scope)
        const submitConsent = useSubmitConsentMutation(scope)
        // Read only on a duplicate, to see where an earlier save left the record.
        const { refetch: refetchRecord } = useOnboardingDetailsQuery(scope, {
            onboardingId,
            enabled: false,
        })
        const { data: settings } = useRegistrationSettingsQuery(scope)

        const [selectedCountry, setSelectedCountry] =
            useState<Optional<SupportedCountry>>(undefined)
        const [selectedUsState, setSelectedUsState] =
            useState<Optional<SupportedUsState>>(undefined)
        const [cardTermsAccepted, setCardTermsAccepted] = useState(false)
        const [isSameMailingAddress, setIsSameMailingAddress] = useState(true)
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
        const platformTermsUrl = withLanguageParam(
            config.termsOfServiceUrl,
            currentLanguage,
        )
        const cardTermsUrl =
            toValidatedBrowserUrl(
                settings?.termsAndConditionsUrls?.[
                    isUsResident ? 'us' : 'intl'
                ],
            ) ?? platformTermsUrl

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

        // Baanx fixed the residence at the email step and the address call
        // carries no country, so the picker is only offered when nothing was
        // stored (a resumed session that skipped that step).
        const isCountryLocked = !!residenceCountryIso
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

        const handleToggleCardTerms = useCallback(
            () => setCardTermsAccepted(previous => !previous),
            [],
        )
        const handleTogglePlatformTerms = useCallback(
            () => setPlatformTermsAccepted(previous => !previous),
            [],
        )
        const handleToggleSameMailingAddress = useCallback(
            () => setIsSameMailingAddress(previous => !previous),
            [],
        )

        const handleToggleMarketing = useCallback(
            () => setAllowMarketing(!(allowMarketing ?? false)),
            [setAllowMarketing, allowMarketing],
        )
        const handleToggleSms = useCallback(
            () => setAllowSms(!(allowSms ?? false)),
            [setAllowSms, allowSms],
        )

        const handleOpenCardTerms = useCallback(() => {
            if (!routeCapabilities.inAppWebView) {
                void Linking.openURL(cardTermsUrl)
                return
            }
            pushWebView({ url: cardTermsUrl, id: 'card-terms' })
        }, [pushWebView, cardTermsUrl])
        const handleOpenPlatformTerms = useCallback(() => {
            // Checkbox 2 is Pera's own Terms & Conditions.
            if (!routeCapabilities.inAppWebView) {
                void Linking.openURL(platformTermsUrl)
                return
            }
            pushWebView({ url: platformTermsUrl, id: 'platform-terms' })
        }, [pushWebView, platformTermsUrl])

        const submitAddressForm = handleSubmit(async values => {
            // Re-collected SMS consent gates Continue; guard here too so no
            // edge path (a stray/programmatic submit) can record a silent
            // denial on a resumed session.
            if (showsConsentOptIns && allowSms !== true) return
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
                // Only US residents may ship the card elsewhere, so the toggle
                // is offered to them alone.
                isSameMailingAddress: isUsResident
                    ? isSameMailingAddress
                    : true,
                ...(values.addressLine2
                    ? { addressLine2: values.addressLine2 }
                    : {}),
                ...(values.countryIso === US_ISO && values.usState
                    ? { usState: values.usState }
                    : {}),
            }
            const nextLocalStep = address.isSameMailingAddress
                ? OnboardingStep.Verification
                : OnboardingStep.MailingAddress
            try {
                // Baanx's two-step consent: create the set (T&Cs + marketing)
                // before the address; it is linked to the user once the account
                // exists after KYC. Continue gates on both T&C boxes.
                await submitConsent.mutateAsync({
                    onboardingId,
                    policyType: isUsResident ? 'US' : 'global',
                    // Both T&C boxes gate Continue, so they're accepted here.
                    termsAccepted: cardTermsAccepted && platformTermsAccepted,
                    // Marketing/SMS come from the Set-Password screen, or from
                    // this screen's re-collected boxes on a resumed session
                    // (SMS gates Continue then, so null can't reach here).
                    allowMarketing: allowMarketing ?? false,
                    allowSms: allowSms ?? false,
                })
                await submitAddress.mutateAsync(address)
                // The address response names no phase, so the residence and the
                // mailing toggle decide; a token Baanx sent has already
                // finished registration, which the router sees as a session.
                goToNextStep({ localStep: nextLocalStep })
            } catch (error) {
                // The address step no longer creates the account, so a
                // duplicate is usually an earlier save whose response was lost,
                // and the record's phase says what's next. Only a record that's
                // gone means the registration finished and needs a sign-in.
                // Otherwise prefer Baanx's own message.
                const apiError = await getCardApiError(error)
                if (
                    isDuplicateError(apiError) ||
                    isUserAlreadyCreatedError(apiError)
                ) {
                    const { data: record, error: recordError } =
                        await refetchRecord()
                    if (record) {
                        goToNextStep({
                            phase: record.phase,
                            localStep: nextLocalStep,
                        })
                        return
                    }
                    const isRecordGone =
                        recordError !== null &&
                        isOnboardingNotFoundError(
                            await getCardApiError(recordError),
                        )
                    if (!isRecordGone) {
                        await showError(error, apiError)
                        return
                    }
                    infoToast(
                        t('peraCard.address.already_registered_title'),
                        t('peraCard.address.already_registered_body'),
                    )
                    navigation.navigate('CardSignIn', {
                        email: getCardOnboardingProgress().email ?? undefined,
                        finishesRegistration: true,
                    })
                    return
                }
                await showError(error, apiError)
            }
        })

        const handleConfirm = () => {
            trackEvent(CardEvent.CreateVerifyAccountContinue2)
            void submitAddressForm()
        }

        return {
            control,
            errors,
            isValid:
                isFormValid &&
                cardTermsAccepted &&
                platformTermsAccepted &&
                // Re-collected SMS consent is required by Baanx, so it gates
                // Continue exactly like on the Set-Password screen.
                (!showsConsentOptIns || allowSms === true),
            isSubmitting: submitAddress.isPending || submitConsent.isPending,
            selectedCountry,
            isCountryLocked,
            isUsResident,
            selectedUsState,
            isSameMailingAddress,
            handleToggleSameMailingAddress,
            cardTermsAccepted,
            platformTermsAccepted,
            showsConsentOptIns,
            allowMarketing: allowMarketing ?? false,
            allowSms: allowSms ?? false,
            handleToggleMarketing,
            handleToggleSms,
            handleSelectCountry,
            handleSelectUsState,
            handleToggleCardTerms,
            handleTogglePlatformTerms,
            handleOpenCardTerms,
            handleOpenPlatformTerms,
            handleConfirm,
        }
    }
