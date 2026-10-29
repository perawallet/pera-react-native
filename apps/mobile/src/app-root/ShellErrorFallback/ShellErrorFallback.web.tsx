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

import React from 'react'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { PWButton, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useAppShellRootStyles } from '../styles.web'

// A crypto wallet must never white-screen silently, so this renders a themed
// reload screen. It lives INSIDE ThemeProvider so its makeStyles have a theme.
export type ShellErrorFallbackProps = {
    reset: () => void
}

export const ShellErrorFallback = ({
    reset,
}: ShellErrorFallbackProps): React.JSX.Element => {
    const { t } = useLanguage()
    const rootStyles = useAppShellRootStyles()

    return (
        <PWView style={rootStyles.root}>
            <PWView style={rootStyles.card}>
                <EmptyView
                    title={t('app.initialization_failed.title')}
                    body={t('app.initialization_failed.body')}
                    testID='shell-error-fallback'
                    button={
                        <PWButton
                            variant='primary'
                            title={t('common.retry.label')}
                            testID='shell-error-reload'
                            onPress={() => {
                                reset()
                                if (typeof window !== 'undefined') {
                                    window.location.reload()
                                }
                            }}
                        />
                    }
                />
            </PWView>
        </PWView>
    )
}
