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
import {
    PWButton,
    PWIcon,
    PWInput,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardOnboardingMailingAddressScreen } from './useCardOnboardingMailingAddressScreen'
import { useStyles } from './styles'

export const CardOnboardingMailingAddressScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        selectedUsState,
        handleSelectUsState,
        handleConfirm,
    } = useCardOnboardingMailingAddressScreen()

    return (
        <PWScreen testID='card-onboarding-mailing-address'>
            <PWView style={styles.content}>
                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {t('peraCard.mailing_address.body')}
                </PWText>

                <PWView style={styles.fields}>
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
                                returnKeyType='next'
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
                                testID='card-onboarding-mailing-address-line1-input'
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
                                returnKeyType='next'
                                testID='card-onboarding-mailing-address-line2-input'
                            />
                        )}
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
                                    returnKeyType='next'
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error && value
                                            ? t('peraCard.address.city_invalid')
                                            : undefined
                                    }
                                    testID='card-onboarding-mailing-address-city-input'
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
                                    returnKeyType='done'
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error && value
                                            ? t('peraCard.address.zip_invalid')
                                            : undefined
                                    }
                                    testID='card-onboarding-mailing-address-zip-input'
                                />
                            )}
                        />
                    </PWView>

                    <PWTouchableOpacity
                        onPress={handleSelectUsState}
                        accessibilityRole='button'
                        accessibilityLabel={`${t('peraCard.address.us_state_label')}, ${selectedUsState ? selectedUsState.name : t('peraCard.address.us_state_placeholder')}`}
                        testID='card-onboarding-mailing-address-state-field'
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
                                testID='card-onboarding-mailing-address-state-input'
                            />
                        </PWView>
                    </PWTouchableOpacity>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.address.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-mailing-address-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
