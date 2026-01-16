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

import { InputProps } from '@rneui/base'

import { PWIcon, PWInput } from '@components/core'
import { useStyles } from './styles'

/**
 * Props for the SearchInput component.
 */
export type SearchInputProps = {} & Omit<
    InputProps,
    'leftIcon' | 'rightIcon' | 'ref'
>

/**
 * A specialized version of PWInput pre-configured for search scenarios.
 * Includes a magnifying glass icon and standard search input behaviors.
 *
 * @example
 * <SearchInput
 *   placeholder="Search assets..."
 *   onChangeText={(text) => handleSearch(text)}
 * />
 */
export const SearchInput = (props: SearchInputProps) => {
    const styles = useStyles()

    return (
        <PWInput
            {...props}
            inputContainerStyle={[props.inputContainerStyle, styles.search]}
            placeholder={props.placeholder ?? 'Search'}
            leftIcon={
                <PWIcon
                    name='magnifying-glass'
                    variant='secondary'
                />
            }
            // @ts-expect-error - passed through to RN Input
            clearButtonMode='while-editing'
            selectTextOnFocus
            autoComplete='off'
            autoCapitalize='none'
            autoCorrect={false}
        />
    )
}
