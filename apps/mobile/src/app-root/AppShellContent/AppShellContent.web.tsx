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
import { ThemeProvider } from '@rneui/themed'
import type { AppProvidersProps } from '@providers/AppProviders'
import { useAppTheme } from '@hooks/useAppTheme'
import { useCrashReporterBinding } from '@hooks/useCrashReporterBinding'
import { useIntegrityAccessSync } from '@hooks/useIntegrityAccessSync.web'
import { useIntegrityTokenSync } from '../../useIntegrityTokenSync.web'
import { WebShellErrorBoundary } from '../WebShellErrorBoundary'
import { AppShellThemedRoot } from '../AppShellThemedRoot'

export type AppShellContentProps = {
    persister: AppProvidersProps['persister']
}

export const AppShellContent = ({
    persister,
}: AppShellContentProps): React.JSX.Element => {
    const theme = useAppTheme()
    useIntegrityTokenSync()
    useIntegrityAccessSync()
    useCrashReporterBinding()

    return (
        <ThemeProvider theme={theme}>
            <WebShellErrorBoundary>
                <AppShellThemedRoot persister={persister} />
            </WebShellErrorBoundary>
        </ThemeProvider>
    )
}
