import { Switch as RNESwitch } from '@rneui/themed'

import { StyleProp, ViewStyle } from 'react-native'

export type PWSwitchProps = {
    value: boolean
    onValueChange: (value: boolean) => void
    disabled?: boolean
    style?: StyleProp<ViewStyle>
    color?: string
}

export const PWSwitch = ({
    value,
    onValueChange,
    disabled,
    style,
    color,
}: PWSwitchProps) => {
    // const styles = useStyles()

    return (
        <RNESwitch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            style={style}
            color={color}
        />
    )
}
