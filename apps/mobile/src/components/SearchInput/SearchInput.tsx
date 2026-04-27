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

import { forwardRef, useCallback, useState } from 'react'
import { useTheme } from '@rneui/themed'

import { PWInput, PWTouchableIcon } from '@components/core'
import { PWIcon } from '@components/core/PWIcon'
import { useStyles } from './styles'

import type { PWInputProps, PWInputRef } from '@components/core'

export type SearchInputProps = Omit<PWInputProps, 'leftIcon' | 'rightIcon'>

export type SearchInputRef = PWInputRef

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(
    (props, ref) => {
        const styles = useStyles()
        const { theme } = useTheme()
        const { onChangeText, value } = props
        const [internalValue, setInternalValue] = useState('')
        const currentValue = value ?? internalValue
        const hasValue = !!currentValue && String(currentValue).length > 0

        const handleChangeText = useCallback(
            (text: string) => {
                setInternalValue(text)
                onChangeText?.(text)
            },
            [onChangeText],
        )

        const handleClear = useCallback(() => {
            setInternalValue('')
            onChangeText?.('')
        }, [onChangeText])

        return (
            <PWInput
                ref={ref}
                {...props}
                value={currentValue}
                onChangeText={handleChangeText}
                containerStyle={[styles.container, props.containerStyle]}
                inputContainerStyle={[styles.search, props.inputContainerStyle]}
                inputStyle={styles.input}
                placeholder={props.placeholder ?? 'Search'}
                placeholderTextColor={theme.colors.textGray}
                renderErrorMessage={false}
                leftIcon={
                    <PWIcon
                        name='magnifying-glass'
                        variant='secondary'
                    />
                }
                rightIcon={
                    hasValue ? (
                        <PWTouchableIcon
                            name='cross'
                            variant='primary'
                            size='md'
                            onPress={handleClear}
                        />
                    ) : undefined
                }
                rightIconContainerStyle={styles.rightIconContainer}
                selectTextOnFocus
                autoComplete='off'
                autoCapitalize='none'
                autoCorrect={false}
            />
        )
    },
)

SearchInput.displayName = 'SearchInput'
