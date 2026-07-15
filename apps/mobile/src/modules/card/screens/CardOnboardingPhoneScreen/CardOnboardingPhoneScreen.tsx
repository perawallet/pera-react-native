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
import { isoToFlagEmoji } from '../../utils/isoToFlagEmoji'
import { useCardOnboardingPhoneScreen } from './useCardOnboardingPhoneScreen'
import { useStyles } from './styles'

export const CardOnboardingPhoneScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        isValid,
        isSubmitting,
        selectedCallingCountry,
        handleSelectCallingCountry,
        handleConfirm,
    } = useCardOnboardingPhoneScreen()

    return (
        <PWScreen testID='card-onboarding-phone'>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
                    <PWText
                        variant='footnoteMedium'
                        style={styles.label}
                    >
                        {t('peraCard.verify_phone.phone_label')}
                    </PWText>

                    <PWView style={styles.phoneRow}>
                        {/* Compact calling-code selector; opens the country picker. */}
                        <PWTouchableOpacity
                            onPress={handleSelectCallingCountry}
                            accessibilityRole='button'
                            accessibilityLabel={t(
                                'peraCard.verify_phone.calling_code_label',
                            )}
                            style={styles.callingCode}
                            testID='card-onboarding-phone-calling-code'
                        >
                            <PWView
                                pointerEvents='none'
                                importantForAccessibility='no-hide-descendants'
                                accessibilityElementsHidden
                            >
                                <PWInput
                                    value={
                                        selectedCallingCountry
                                            ? `${isoToFlagEmoji(selectedCallingCountry.iso3166alpha2)} +${selectedCallingCountry.callingCode}`
                                            : ''
                                    }
                                    placeholder={t(
                                        'peraCard.verify_phone.calling_code_placeholder',
                                    )}
                                    editable={false}
                                    renderErrorMessage={false}
                                    rightIcon={
                                        <PWIcon
                                            name='chevron-down'
                                            variant='secondary'
                                            size='sm'
                                        />
                                    }
                                />
                            </PWView>
                        </PWTouchableOpacity>

                        <Controller
                            control={control}
                            name='phoneNumber'
                            render={({
                                field: { onChange, onBlur, value },
                                fieldState: { error },
                            }) => (
                                <PWInput
                                    containerStyle={styles.numberInput}
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    placeholder={t(
                                        'peraCard.verify_phone.phone_placeholder',
                                    )}
                                    keyboardType='phone-pad'
                                    autoComplete='tel'
                                    autoCorrect={false}
                                    returnKeyType='done'
                                    onSubmitEditing={handleConfirm}
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error?.type === 'server'
                                            ? error.message
                                            : error && value
                                              ? t(
                                                    'peraCard.verify_phone.phone_invalid',
                                                )
                                              : undefined
                                    }
                                    testID='card-onboarding-phone-input'
                                />
                            )}
                        />
                    </PWView>

                    <PWText
                        variant='footnoteMedium'
                        style={styles.helper}
                    >
                        {t('peraCard.verify_phone.phone_helper')}
                    </PWText>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.verify_phone.send_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-phone-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
