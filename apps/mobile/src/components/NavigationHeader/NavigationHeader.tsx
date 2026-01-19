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

import { NativeStackHeaderProps } from '@react-navigation/native-stack'
import { PWToolbar, PWText, PWIcon } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMemo } from 'react'

export type NavigationHeaderProps = NativeStackHeaderProps

export const NavigationHeader = (props: NavigationHeaderProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    const title = useMemo(() => {
        const headerTitle =
            typeof props.options.headerTitle === 'string'
                ? props.options.headerTitle
                : undefined
        const title = headerTitle ?? props.options.title ?? props.route.name

        if (title.includes('.') && !title.includes(' ')) {
            return t(title)
        }
        return title
    }, [props.options.headerTitle, props.options.title, props.route.name, t])

    return (
        <PWToolbar
            style={styles.container}
            left={
                !!props.navigation.canGoBack() && (
                    <PWIcon
                        name='chevron-left'
                        onPress={props.navigation.goBack}
                    />
                )
            }
            center={(
                <PWText
                    variant='h4'
                    style={styles.title}
                >
                    {title}
                </PWText>
            )}
            right={props.options?.headerRight?.({})}
        />
    )
}
