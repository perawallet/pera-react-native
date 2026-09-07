/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWToolbar, PWText, PWIcon, PWTouchableOpacity } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMemo } from 'react'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'
import type { StackHeaderProps } from '@react-navigation/stack'

export type NavigationHeaderProps = (
    | Partial<NativeStackHeaderProps>
    | Partial<StackHeaderProps>
) & {
    safeArea?: boolean
    paddingStyle?: 'dense' | 'normal' | 'none'
}

export const NavigationHeader = (props: NavigationHeaderProps) => {
    const { safeArea = true } = props
    const insets = useSafeAreaInsets()
    const styles = useStyles({ insets, safeArea })
    const { t } = useLanguage()

    const title = useMemo(() => {
        if (typeof props.options?.headerTitle === 'function') {
            return props.options.headerTitle({
                children: props.options?.title ?? props.route?.name ?? '',
                tintColor: undefined,
            })
        }

        const headerTitle =
            typeof props.options?.headerTitle === 'string'
                ? props.options?.headerTitle
                : undefined
        const title = headerTitle ?? props.options?.title ?? props.route?.name

        if (title?.includes('.') && !title?.includes(' ')) {
            return t(title)
        }
        return title
    }, [props.route?.name, t, props.options])

    const left = useMemo(() => {
        if (props.options?.headerLeft) {
            return props.options.headerLeft({
                canGoBack: !!props.navigation?.canGoBack(),
            })
        }

        if (props.navigation?.canGoBack()) {
            return (
                <PWTouchableOpacity
                    onPress={props.navigation?.goBack}
                    testID='navigation_back_button'
                >
                    <PWIcon
                        style={styles.backButton}
                        name='chevron-left'
                    />
                </PWTouchableOpacity>
            )
        }

        return null
    }, [props.navigation, styles.backButton, props.options])

    return (
        props.options?.headerShown && (
            <PWToolbar
                style={styles.container}
                left={left}
                center={
                    typeof title === 'string' ? (
                        <PWText
                            variant='h4'
                            style={styles.title}
                            truncate
                        >
                            {title}
                        </PWText>
                    ) : (
                        title
                    )
                }
                right={props.options?.headerRight?.({})}
                paddingStyle={props.paddingStyle}
            />
        )
    )
}
