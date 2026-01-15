import { Dialog as RNEDialog } from '@rneui/themed'
import { ComponentProps } from 'react'
import { StyleProp, ViewStyle } from 'react-native'

type RNEDialogProps = ComponentProps<typeof RNEDialog>


export type PWDialogProps = {
    isVisible: boolean
    onBackdropPress?: () => void
    children?: React.ReactNode
    overlayStyle?: StyleProp<ViewStyle>
}

const PWDialogComponent = ({
    isVisible,
    onBackdropPress,
    children,
    overlayStyle,
}: PWDialogProps) => {
    return (
        <RNEDialog isVisible={isVisible} onBackdropPress={onBackdropPress} overlayStyle={overlayStyle}>
            {children}
        </RNEDialog>
    )
}

const PWDialogTitle = (props: { title: string; titleStyle?: StyleProp<any> }) => {
    return <RNEDialog.Title title={props.title} titleStyle={props.titleStyle} />
}

const PWDialogActions = (props: { children: React.ReactNode }) => {
    return <RNEDialog.Actions>{props.children}</RNEDialog.Actions>
}

const PWDialogButton = (props: {
    title: string
    onPress?: () => void
    titleStyle?: StyleProp<any>
}) => {
    return (
        <RNEDialog.Button
            title={props.title}
            onPress={props.onPress}
            titleStyle={props.titleStyle}
        />
    )
}

export const PWDialog = Object.assign(PWDialogComponent, {
    Title: PWDialogTitle,
    Actions: PWDialogActions,
    Button: PWDialogButton,
})
