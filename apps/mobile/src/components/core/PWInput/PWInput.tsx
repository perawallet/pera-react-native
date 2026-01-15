import { Input as RNEInput, InputProps as RNEInputProps } from '@rneui/themed'
import { useStyles } from './styles'

export type PWInputProps = {
    value?: string
    onChangeText?: (text: string) => void
    placeholder?: string
    errorMessage?: string
    renderErrorMessage?: boolean
    secureTextEntry?: boolean
    keyboardType?: RNEInputProps['keyboardType']
    autoCapitalize?: RNEInputProps['autoCapitalize']
    autoCorrect?: boolean
    autoFocus?: boolean
    onFocus?: () => void
    onBlur?: () => void
    containerStyle?: RNEInputProps['containerStyle']
    inputContainerStyle?: RNEInputProps['inputContainerStyle']
    inputStyle?: RNEInputProps['inputStyle']
    cursorColor?: string
    rightIcon?: RNEInputProps['rightIcon']
    leftIcon?: RNEInputProps['leftIcon']
    onSubmitEditing?: () => void
    blurOnSubmit?: boolean
    label?: string
    labelStyle?: RNEInputProps['labelStyle']
}

export const PWInput = ({
    value,
    onChangeText,
    placeholder,
    errorMessage,
    renderErrorMessage,
    secureTextEntry,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    autoFocus,
    onFocus,
    onBlur,
    containerStyle,
    inputContainerStyle,
    inputStyle,
    cursorColor,
    rightIcon,
    leftIcon,
    onSubmitEditing,
    blurOnSubmit,
    label,
    labelStyle,
}: PWInputProps) => {
    const styles = useStyles()

    return (
        <RNEInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            errorMessage={errorMessage}
            renderErrorMessage={renderErrorMessage}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            autoFocus={autoFocus}
            onFocus={onFocus}
            onBlur={onBlur}
            containerStyle={[styles.container, containerStyle]}
            inputContainerStyle={inputContainerStyle}
            inputStyle={inputStyle}
            cursorColor={cursorColor}
            rightIcon={rightIcon}
            leftIcon={leftIcon}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit}
            label={label}
            labelStyle={labelStyle}
            placeholderTextColor={undefined} // Let theme handle it unless overridden
        />
    )
}
