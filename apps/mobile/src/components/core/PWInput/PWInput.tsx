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

import { Input as RNEInput, InputProps as RNEInputProps } from '@rneui/themed'
import { useStyles } from './styles'

/**
 * Props for the PWInput component.
 */
export type PWInputProps = {
    /** Current value of the input */
    value?: string
    /** Callback when the text changes */
    onChangeText?: (text: string) => void
    /** Placeholder text displayed when empty */
    placeholder?: string
    /** Error message to display below the input */
    errorMessage?: string
    /** Whether to render the error message space */
    renderErrorMessage?: boolean
    /** Whether to mask the input for passwords */
    secureTextEntry?: boolean
    /** Type of keyboard to display */
    keyboardType?: RNEInputProps['keyboardType']
    /** Auto-capitalization behavior */
    autoCapitalize?: RNEInputProps['autoCapitalize']
    /** Whether to enable auto-correction */
    autoCorrect?: boolean
    /** Whether the input should auto-focus */
    autoFocus?: boolean
    /** Callback when the input is focused */
    onFocus?: () => void
    /** Callback when the input is blurred */
    onBlur?: () => void
    /** Style overrides for the outer container */
    containerStyle?: RNEInputProps['containerStyle']
    /** Style overrides for the input container */
    inputContainerStyle?: RNEInputProps['inputContainerStyle']
    /** Style overrides for the text input itself */
    inputStyle?: RNEInputProps['inputStyle']
    /** Color of the insertion cursor */
    cursorColor?: string
    /** Icon to display on the right side */
    rightIcon?: RNEInputProps['rightIcon']
    /** Icon to display on the left side */
    leftIcon?: RNEInputProps['leftIcon']
    /** Callback when the submit button is pressed */
    onSubmitEditing?: () => void
    /** Whether to blur on submit */
    blurOnSubmit?: boolean
    /** Label text to display above the input */
    label?: string
    /** Style overrides for the label */
    labelStyle?: RNEInputProps['labelStyle']
}

/**
 * A themed text input component wrapping RNE Input with standard styling.
 *
 * @example
 * <PWInput
 *   label="Address"
 *   placeholder="Enter address"
 *   value={address}
 *   onChangeText={setAddress}
 * />
 */
export const PWInput = ({
    containerStyle,
    inputContainerStyle,
    inputStyle,
    labelStyle,
    ...props
}: PWInputProps) => {
    const styles = useStyles()

    return (
        <RNEInput
            {...props}
            containerStyle={[styles.container, containerStyle]}
            inputContainerStyle={[styles.inputContainer, inputContainerStyle]}
            inputStyle={[styles.input, inputStyle]}
            labelStyle={[styles.label, labelStyle]}
            placeholderTextColor={undefined} // Let theme handle it unless overridden
        />
    )
}
