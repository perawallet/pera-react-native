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

import { useMemo } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { PWIcon } from '@components/core/PWIcon'
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import { PWText } from '@components/core/PWText'
import { getTestProps } from '@utils/test-id-helper'
import { getDisplayHost } from './getDisplayHost'

export type WebViewTitleBarProps = {
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
    // The title bar uses none of the inset-dependent styles.
    const styles = useStyles({ bottomInset: 0 })
    const { t } = useLanguage()

    // An opaque origin (about:/data:/blob:) has no host to show. Say so
    // explicitly — a blank origin line under a page-controlled title reads as
    // "no claim made" when the page is in fact unattributable.
    const domain = useMemo(
        () => getDisplayHost(url) ?? t('common.webview.unknown_host'),
        [url, t],
    )

    return (
        <PWView style={styles.titleBar}>
            <PWView style={styles.titleIconContainer}>
                <PWTouchableOpacity
                    {...getTestProps('webview_close_button')}
                    onPress={onCloseRequested}
                >
                    <PWIcon
                        name='cross'
                        variant='primary'
                        size='md'
                    />
                </PWTouchableOpacity>
            </PWView>
            <PWView style={styles.titleBarTextContainer}>
                <PWText
                    numberOfLines={1}
                    style={styles.title}
                >
                    {title}
                </PWText>
                <PWText
                    variant='caption'
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
