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

import { forwardRef } from 'react'
import { InputProps, useTheme } from '@rneui/themed'

import { PWInput, PWTouchableIcon } from '@components/core'
import { PWIcon } from '@components/core/PWIcon'
import { useStyles } from './styles'

import type { PWInputRef } from '@components/core'

export type SearchInputProps = {} & Omit<
    InputProps,
    'leftIcon' | 'rightIcon' | 'ref'
>

export type SearchInputRef = PWInputRef

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(
    (props, ref) => {
        const styles = useStyles()
        const { theme } = useTheme()

        const hasValue = !!props.value && String(props.value).length > 0

        return (
            <PWInput
                ref={ref}
                {...props}
                inputContainerStyle={[props.inputContainerStyle, styles.search]}
                inputStyle={styles.input}
                placeholder={props.placeholder ?? 'Search'}
                placeholderTextColor={theme.colors.textGray}
                leftIcon={
                    <PWIcon
                        name='magnifying-glass'
                        variant='primary'
                    />
                }
                rightIcon={
                    hasValue ? (
                        <PWTouchableIcon
                            name='cross'
                            variant='primary'
                            size='md'
                            onPress={() => props.onChangeText?.('')}
                        />
                    ) : undefined
                }
                // @ts-expect-error - passed through to RN Input
                selectTextOnFocus
                autoComplete='off'
                autoCapitalize='none'
                autoCorrect={false}
            />
        )
    },
)

SearchInput.displayName = 'SearchInput'
