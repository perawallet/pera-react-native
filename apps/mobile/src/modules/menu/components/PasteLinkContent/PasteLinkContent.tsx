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

import React from 'react'
import { PWButton, PWInput, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { usePasteLinkContent } from './usePasteLinkContent'
import { useStyles } from './styles'

export const PasteLinkContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    // Sheet contents dismiss themselves through the id-scoped handle rather
    // than a callback threaded down from the call site (same pattern as
    // ConfirmActionContent). Kept here, not in usePasteLinkContent, so the
    // hook stays unit-testable without a BottomSheetIdContext provider.
    const { dismiss } = useBottomSheetResult()
    const {
        value,
        isSubmitting,
        hasError,
        errorMessageKey,
        setValue,
        handleSubmit,
    } = usePasteLinkContent(dismiss)

    return (
        <PWView>
            <SheetHeader
                title={t('paste_link.title')}
                showClose
            />
            <PWView style={styles.body}>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('paste_link.description')}
                </PWText>
                <PWInput
                    testID='paste-link-input'
                    value={value}
                    onChangeText={setValue}
                    placeholder={t('paste_link.placeholder')}
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoFocus
                    editable={!isSubmitting}
                    onSubmitEditing={handleSubmit}
                />
                {hasError && errorMessageKey && (
                    <PWText
                        testID='paste-link-error'
                        variant='body'
                        style={styles.errorText}
                    >
                        {t(errorMessageKey)}
                    </PWText>
                )}
                <PWButton
                    testID='paste-link-submit'
                    variant='primary'
                    title={t('paste_link.submit')}
                    isDisabled={value.trim().length === 0 || isSubmitting}
                    isLoading={isSubmitting}
                    onPress={handleSubmit}
                />
            </PWView>
        </PWView>
    )
}
