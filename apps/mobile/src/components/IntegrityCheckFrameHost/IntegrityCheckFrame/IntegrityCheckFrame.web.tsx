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
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useIntegrityCheckFrameHost } from '../useIntegrityCheckFrameHost.web'
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

export const IntegrityCheckFrame = (): Nullable<React.JSX.Element> => {
    const { url, isExpanded, iframeRef, dismiss } = useIntegrityCheckFrameHost()
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
                {/* Outside the iframe and before it: a false slot keeps the
                    frame's position, so expanding never remounts a live solve. */}
                {isExpanded && (
                    <PWView style={styles.header}>
                        <PWText style={styles.heading}>
                            {t('integrityCheck.frame_heading')}
                        </PWText>
                        <PWButton
                            variant='link'
                            title={t('integrityCheck.frame_dismiss')}
                            onPress={dismiss}
                        />
                    </PWView>
                )}
                <IFrame
                    ref={iframeRef}
                    src={url}
                    sandbox={CHECK_FRAME_SANDBOX}
                    title={title}
                    // Out of the tab order and the accessibility tree while
                    // hidden; unlike display: none, scripts keep running.
                    inert={!isExpanded}
                    // Fills what the heading leaves; both wrappers are flex columns.
                    // oxlint-disable-next-line react-native/no-inline-styles -- makeStyles ids cannot style a raw element
                    style={{ border: 0, width: '100%', flex: 1, minHeight: 0 }}
                />
            </PWView>
        </PWView>,
        document.body,
    )
}
