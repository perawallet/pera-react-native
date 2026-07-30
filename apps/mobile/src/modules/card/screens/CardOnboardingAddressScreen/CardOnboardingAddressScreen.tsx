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

import { Controller } from 'react-hook-form'
import { Trans } from 'react-i18next'
import {
    PWButton,
    PWIcon,
    PWInput,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { CardConsentCheckboxRow } from '@modules/card/components/CardConsentCheckboxRow'
import { useLanguage } from '@hooks/useLanguage'
import { CardKycRequiredView } from '../../components/CardKycRequiredView'
import { CountrySelectorField } from '../../components/CountrySelectorField'
import { useCardOnboardingAddressScreen } from './useCardOnboardingAddressScreen'
import { useStyles } from './styles'

export const CardOnboardingAddressScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        selectedCountry,
        isUsResident,
        selectedUsState,
        cardTermsAccepted,
        platformTermsAccepted,
        showsConsentOptIns,
        allowMarketing,
        allowSms,
        handleToggleMarketing,
        handleToggleSms,
        handleSelectCountry,
        handleSelectUsState,
        handleToggleCardTerms,
        handleTogglePlatformTerms,
        handleOpenCardTerms,
        handleOpenPlatformTerms,
        isKycRequired,
        handleVerifyIdentity,
        handleConfirm,
    } = useCardOnboardingAddressScreen()

    // Baanx refuses this step until the identity check is far enough along, so
    // the form is replaced rather than shown unsubmittable.
    if (isKycRequired) {
        return <CardKycRequiredView onVerify={handleVerifyIdentity} />
    }

    return (
        <PWScreen testID='card-onboarding-address'>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
                    <CountrySelectorField
                        label={t('peraCard.address.country_label')}
                        placeholder={t('peraCard.address.country_label')}
                        country={selectedCountry}
                        onPress={handleSelectCountry}
                        errorMessage={
                            errors.countryIso
                                ? t('peraCard.address.country_required')
                                : undefined
                        }
                        testID='card-onboarding-address-country-field'
                    />

                    <PWView style={styles.row}>
                        <Controller
                            control={control}
                            name='city'
                            render={({
                                field: { onChange, onBlur, value },
                                fieldState: { error },
                            }) => (
                                <PWInput
                                    containerStyle={styles.rowItem}
                                    label={t('peraCard.address.city_label')}
                                    labelStyle={styles.label}
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    autoCapitalize='words'
                                    autoCorrect={false}
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error && value
                                            ? t('peraCard.address.city_invalid')
                                            : undefined
                                    }
                                    testID='card-onboarding-address-city-input'
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name='zip'
                            render={({
                                field: { onChange, onBlur, value },
                                fieldState: { error },
                            }) => (
                                <PWInput
                                    containerStyle={styles.rowItem}
                                    label={t('peraCard.address.zip_label')}
                                    labelStyle={styles.label}
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    autoCapitalize='characters'
                                    autoCorrect={false}
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error && value
                                            ? t('peraCard.address.zip_invalid')
                                            : undefined
                                    }
                                    testID='card-onboarding-address-zip-input'
                                />
                            )}
                        />
                    </PWView>

                    <Controller
                        control={control}
                        name='addressLine1'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t(
                                    'peraCard.address.address_line1_label',
                                )}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='words'
                                autoCorrect={false}
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.address.address_line1_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-address-line1-input'
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name='addressLine2'
                        render={({ field: { onChange, onBlur, value } }) => (
                            <PWInput
                                label={t(
                                    'peraCard.address.address_line2_label',
                                )}
                                labelStyle={styles.label}
                                value={value ?? ''}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='words'
                                autoCorrect={false}
                                renderErrorMessage={false}
                                testID='card-onboarding-address-line2-input'
                            />
                        )}
                    />

                    {isUsResident ? (
                        <PWTouchableOpacity
                            onPress={handleSelectUsState}
                            accessibilityRole='button'
                            accessibilityLabel={`${t('peraCard.address.us_state_label')}, ${selectedUsState ? selectedUsState.name : t('peraCard.address.us_state_placeholder')}`}
                            testID='card-onboarding-address-state-field'
                        >
                            <PWView
                                pointerEvents='none'
                                importantForAccessibility='no-hide-descendants'
                                accessibilityElementsHidden
                            >
                                <PWInput
                                    label={t('peraCard.address.us_state_label')}
                                    labelStyle={styles.label}
                                    value={selectedUsState?.name ?? ''}
                                    placeholder={t(
                                        'peraCard.address.us_state_placeholder',
                                    )}
                                    editable={false}
                                    renderErrorMessage={!!errors.usState}
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        errors.usState
                                            ? t(
                                                  'peraCard.address.us_state_required',
                                              )
                                            : undefined
                                    }
                                    rightIcon={
                                        <PWIcon
                                            name='chevron-down'
                                            variant='secondary'
                                        />
                                    }
                                    testID='card-onboarding-address-state-input'
                                />
                            </PWView>
                        </PWTouchableOpacity>
                    ) : null}
                </PWView>

                <PWView style={styles.checkboxes}>
                    {/* A resumed sign-in skipped the Set-Password screen, so the
                        marketing/SMS consents were never asked this session —
                        re-collect them here (same copy; SMS gates Continue). */}
                    {showsConsentOptIns ? (
                        <>
                            <CardConsentCheckboxRow
                                checked={allowSms}
                                onPress={handleToggleSms}
                                testID='card-onboarding-address-sms-checkbox'
                            >
                                {t('peraCard.create_password.sms_opt_in')}
                            </CardConsentCheckboxRow>

                            <CardConsentCheckboxRow
                                checked={allowMarketing}
                                onPress={handleToggleMarketing}
                                testID='card-onboarding-address-marketing-checkbox'
                            >
                                {t('peraCard.create_password.marketing_opt_in')}
                            </CardConsentCheckboxRow>
                        </>
                    ) : null}

                    <CardConsentCheckboxRow
                        checked={cardTermsAccepted}
                        onPress={handleToggleCardTerms}
                        testID='card-onboarding-address-card-terms-checkbox'
                    >
                        <Trans
                            i18nKey='peraCard.address.card_terms'
                            components={[
                                <PWText
                                    key='link'
                                    variant='linkPositive'
                                    onPress={handleOpenCardTerms}
                                    testID='card-onboarding-address-card-terms-link'
                                />,
                            ]}
                        />
                    </CardConsentCheckboxRow>

                    <CardConsentCheckboxRow
                        checked={platformTermsAccepted}
                        onPress={handleTogglePlatformTerms}
                        testID='card-onboarding-address-platform-terms-checkbox'
                    >
                        <Trans
                            i18nKey='peraCard.address.platform_terms'
                            components={[
                                <PWText
                                    key='link'
                                    variant='linkPositive'
                                    onPress={handleOpenPlatformTerms}
                                    testID='card-onboarding-address-platform-terms-link'
                                />,
                            ]}
                        />
                    </CardConsentCheckboxRow>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.address.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-address-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
