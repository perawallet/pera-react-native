import { TabView as RNETabView } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, ViewStyle, Animated } from 'react-native'
import { ReactNode } from 'react'

export type PWTabViewProps = {
    value?: number
    onChange?: (value: number) => void
    animationType?: 'spring' | 'timing'
    animationConfig?: Omit<
        Animated.SpringAnimationConfig & Animated.TimingAnimationConfig,
        'toValue'
    >
    children?: ReactNode
}

const PWTabViewComponent = ({
    value,
    onChange,
    animationType,
    animationConfig,
    children,
}: PWTabViewProps) => {
    return (
        <RNETabView
            value={value}
            onChange={onChange}
            animationType={animationType}
            animationConfig={animationConfig}
        >
            {children}
        </RNETabView>
    )
}

export type PWTabViewItemProps = {
    children?: ReactNode
    style?: StyleProp<ViewStyle>
}

const PWTabViewItem = ({ children, style }: PWTabViewItemProps) => {
    return (
        <RNETabView.Item style={style}>
            {children}
        </RNETabView.Item>
    )
}

export const PWTabView = Object.assign(PWTabViewComponent, {
    Item: PWTabViewItem,
})
