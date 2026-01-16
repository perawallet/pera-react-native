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

import { Switch as RNESwitch } from '@rneui/themed'

import { StyleProp, ViewStyle } from 'react-native'

/**
 * Props for the PWSwitch component.
 */
export type PWSwitchProps = {
    /** Current boolean value of the switch */
    value: boolean
    /** Callback when the switch value changes */
    onValueChange: (value: boolean) => void
    /** Whether the switch is disabled */
    disabled?: boolean
    /** Optional style overrides for the switch */
    style?: StyleProp<ViewStyle>
    /** Optional color override for the switch when active */
    color?: string
}

/**
 * A themed switch component for toggling boolean settings.
 * Wraps RNE Switch with standard styling.
 *
 * @example
 * <PWSwitch value={isEnabled} onValueChange={setIsEnabled} />
 */
export const PWSwitch = ({
    value,
    onValueChange,
    disabled,
    style,
    color,
    ...props
}: PWSwitchProps) => {
    // const styles = useStyles()

    return (
        <RNESwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            style={style}
            color={color}
            {...props}
        />
    )
}
