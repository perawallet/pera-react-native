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

import { useMemo } from 'react'
import { PWIcon } from '@components/core/PWIcon'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWText } from '@components/core/PWText'

type WebViewTitleBarProps = {
    title: string
    url: string
    onCloseRequested?: () => void
    onReload?: () => void
}

export const WebViewTitleBar = ({
    title,
    url,
    onCloseRequested,
    onReload,
}: WebViewTitleBarProps) => {
    const styles = useStyles()

    const domain = useMemo(() => {
        return new URL(url).hostname
    }, [url])

    return (
        <PWView style={styles.titleBar}>
            <PWView style={styles.titleIconContainer}>
                <PWIcon
                    name='cross'
                    onPress={onCloseRequested}
                    variant='primary'
                    size='md'
                />
            </PWView>
            <PWView style={styles.titleBarTextContainer}>
                <PWText
                    numberOfLines={1}
                    style={styles.title}
                >
                    {title}
                </PWText>
                <PWText
                    numberOfLines={1}
                    style={styles.url}
                >
                    {domain}
                </PWText>
            </PWView>
            <PWView style={styles.titleIconContainer}>
                <PWIcon
                    name='reload'
                    onPress={onReload}
                    variant='primary'
                    size='md'
                />
            </PWView>
        </PWView>
    )
}
