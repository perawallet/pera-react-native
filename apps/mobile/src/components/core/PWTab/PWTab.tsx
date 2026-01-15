import { Tab as RNETab, IconProps } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, ViewStyle, TextStyle } from 'react-native'
import { ComponentProps, ReactElement, ReactNode } from 'react'

export type PWTabProps = {
    value?: number
    onChange?: (value: number) => void
    disableIndicator?: boolean
    indicatorStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
    buttonStyle?: StyleProp<ViewStyle>
    titleStyle?: StyleProp<TextStyle>
    variant?: 'primary' | 'default'
    dense?: boolean
    children?: ReactNode
}

const PWTabComponent = ({
    value,
    onChange,
    disableIndicator,
    indicatorStyle,
    containerStyle,
    variant = 'default',
    dense,
    children,
    buttonStyle,
    titleStyle,
}: PWTabProps) => {
    return (
        <RNETab
            value={value}
            onChange={onChange}
            disableIndicator={disableIndicator}
            indicatorStyle={indicatorStyle}
            containerStyle={containerStyle}
            variant={variant}
            dense={dense}
            buttonStyle={buttonStyle}
            titleStyle={titleStyle}
        >
            {children}
        </RNETab>
    )
}

export type PWTabItemProps = {
    title?: string
    titleStyle?: StyleProp<TextStyle>
    icon?: IconProps | ReactElement
    buttonStyle?: StyleProp<ViewStyle>
    containerStyle?: StyleProp<ViewStyle>
}

const PWTabItem = ({
    title,
    titleStyle,
    icon,
    buttonStyle,
    containerStyle,
}: PWTabItemProps) => {
    return (
        <RNETab.Item
            title={title}
            titleStyle={titleStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            icon={icon as any}
            buttonStyle={buttonStyle}
            containerStyle={containerStyle}
        />
    )
}

export const PWTab = Object.assign(PWTabComponent, {
    Item: PWTabItem,
})
