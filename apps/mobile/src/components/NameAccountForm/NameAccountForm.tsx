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

import type { ReactNode } from 'react'
import {
    PWButton,
    PWInput,
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type NameAccountFormProps = {
    title: string
    description: string
    finishButtonTitle: string
    loadingTitle: string
    value: string
    onChangeText: (value: string) => void
    onFinish: () => void
    isLoading: boolean
    isDisabled?: boolean
    errorMessage?: string
    children?: ReactNode
}

export const NameAccountForm = ({
    title,
    description,
    finishButtonTitle,
    loadingTitle,
    value,
    onChangeText,
    onFinish,
    isLoading,
    isDisabled,
    errorMessage,
    children,
}: NameAccountFormProps) => {
    const styles = useStyles()

    return (
        <>
            <PWScreen
                footer={
                    <PWButton
                        variant='primary'
                        title={finishButtonTitle}
                        onPress={onFinish}
                        isLoading={isLoading}
                        isDisabled={isDisabled ?? isLoading}
                        testID='name_account_finish_button'
                    />
                }
            >
                <PWView style={styles.headerContainer}>
                    <PWText variant='h1'>{title}</PWText>
                    <PWText
                        variant='h4'
                        style={styles.description}
                    >
                        {description}
                    </PWText>
                </PWView>

                {children}

                <PWInput
                    containerStyle={styles.input}
                    inputContainerStyle={styles.inputContainer}
                    value={value}
                    onChangeText={onChangeText}
                    autoFocus
                    autoCorrect={false}
                    testID='name_account_name_input'
                    errorMessage={errorMessage}
                    rightIcon={
                        value ? (
                            <PWTouchableIcon
                                name='cross'
                                variant='secondary'
                                size='sm'
                                onPress={() => onChangeText('')}
                                dismissKeyboardOnPress={false}
                                containerStyle={styles.clearButton}
                                testID='name_account_clear_button'
                            />
                        ) : undefined
                    }
                />
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isLoading}
                title={loadingTitle}
            />
        </>
    )
}
