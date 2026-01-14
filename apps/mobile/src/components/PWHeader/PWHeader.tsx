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

import { Text } from '@rneui/themed'
import PWIcon, { IconName } from '../PWIcon/PWIcon'
import PWView from '../PWView/PWView'
import { useStyles } from './styles'
import { PropsWithChildren } from 'react'

type PWHeaderProps = {
    title?: string
    leftIcon?: IconName
    rightIcon?: IconName
    onLeftPress?: () => void
    onRightPress?: () => void
} & PropsWithChildren

const PWHeader = ({
    title,
    leftIcon,
    rightIcon,
    onLeftPress,
    onRightPress,
    children,
}: PWHeaderProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconContainer}>
                {!!leftIcon && (
                    <PWIcon
                        name={leftIcon}
                        onPress={onLeftPress}
                    />
                )}
            </PWView>
            <PWView style={styles.childContainer}>
                {children}
                {!!title && (
                    <Text
                        h4
                        h4Style={styles.title}
                    >
                        {title}
                    </Text>
                )}
            </PWView>
            <PWView style={styles.iconContainer}>
                {!!rightIcon && (
                    <PWIcon
                        name={rightIcon}
                        onPress={onRightPress}
                    />
                )}
            </PWView>
        </PWView>
    )
}

export default PWHeader
