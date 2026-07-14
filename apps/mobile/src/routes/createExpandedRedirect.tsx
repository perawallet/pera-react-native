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

import React, { useEffect } from 'react'
import { makeStyles } from '@rneui/themed'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    openExpandedTab,
    type ExpandedFlow,
} from '@perawallet/wallet-extension-platform-chrome'

const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: theme.spacing.lg,
    },
}))

/**
 * Popup stand-in for flows that must run in the full tab: mounting it opens
 * expanded.html?flow=… (Chrome then auto-closes the popup on focus change).
 */
export const createExpandedRedirect = (
    flow: ExpandedFlow,
): React.ComponentType => {
    const ExpandedRedirect = (): React.JSX.Element => {
        const styles = useStyles()
        const { t } = useLanguage()

        useEffect(() => {
            // StrictMode/HMR double-invoke is harmless here: openExpandedTab
            // now focuses an already-open expanded tab instead of stacking a
            // second one (see navigation.ts).
            void openExpandedTab(flow)
        }, [])

        return (
            <PWView style={styles.container}>
                <PWText testID='expanded-redirect'>
                    {t('vault.expanded.redirecting')}
                </PWText>
            </PWView>
        )
    }
    ExpandedRedirect.displayName = `ExpandedRedirect(${flow})`
    return ExpandedRedirect
}
