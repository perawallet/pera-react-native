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
import { createPortal } from 'react-dom'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIntegrityCheckFrameHost } from './useIntegrityCheckFrameHost.web'
import { useStyles } from './styles.web'

// react-native-web renders through react-dom, so a raw element works here, as in PWWebView.
const IFrame = 'iframe' as unknown as React.ComponentType<{
    ref?: React.Ref<HTMLIFrameElement>
    src: string
    sandbox: string
    title: string
    inert?: boolean
    style?: React.CSSProperties
}>

// PWWebView's allowances; no allow-top-navigation, so a click in the frame can
// never navigate the wallet page itself.
const CHECK_FRAME_SANDBOX =
    'allow-same-origin allow-scripts allow-forms allow-popups'

const IntegrityCheckFrame = (): React.JSX.Element | null => {
    const { url, isExpanded, iframeRef } = useIntegrityCheckFrameHost()
    const styles = useStyles()
    const { t } = useLanguage()
    const title = t('integrityCheck.frame_title')

    if (!url) return null

    // Into the body: every react-native-web View is its own stacking context,
    // so nothing in the tree can rise above the Modal portals.
    return createPortal(
        <PWView
            style={isExpanded ? styles.backdrop : styles.hidden}
            role={isExpanded ? 'dialog' : undefined}
            aria-modal={isExpanded}
            aria-label={isExpanded ? title : undefined}
        >
            <PWView style={isExpanded ? styles.modal : styles.hiddenFrame}>
                <IFrame
                    ref={iframeRef}
                    src={url}
                    sandbox={CHECK_FRAME_SANDBOX}
                    title={title}
                    // Out of the tab order and the accessibility tree while
                    // hidden; unlike display: none, scripts keep running.
                    inert={!isExpanded}
                    // oxlint-disable-next-line react-native/no-inline-styles -- makeStyles ids cannot style a raw element
                    style={{ border: 0, width: '100%', height: '100%' }}
                />
            </PWView>
        </PWView>,
        document.body,
    )
}

// Its own boundary, so a failure here can never take the shell down.
export const IntegrityCheckFrameHost = (): React.JSX.Element => {
    const { t } = useLanguage()

    return (
        <BaseErrorBoundary
            t={t}
            fallback={() => null}
        >
            <IntegrityCheckFrame />
        </BaseErrorBoundary>
    )
}
