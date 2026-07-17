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

// Web replacement for the react-native-webview-backed PWStaticWebView:
// react-native-webview has no web implementation. Static trusted content
// renders in a sandboxed iframe (srcdoc for bundled HTML, src for URLs).
// MV3 default CSP (script-src 'self') blocks scripts inside srcdoc — fine
// for static terms/policy documents.
import React from 'react'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'
import type { PWStaticWebViewProps } from './PWStaticWebView.types'

// react-native JSX typings have no DOM intrinsics; under react-native-web the
// renderer is react-dom, which renders host elements like 'iframe' directly.
const IFrame = 'iframe' as unknown as React.ComponentType<{
    src?: string
    srcDoc?: string
    sandbox?: string
    title: string
    style?: Record<string, string | number>
}>

export const PWStaticWebView = ({
    source,
}: PWStaticWebViewProps): React.JSX.Element => {
    const styles = useStyles()
    const isBundled = 'html' in source
    const frameProps = isBundled ? { srcDoc: source.html } : { src: source.uri }
    // Bundled HTML never needs scripts, so it gets the maximal sandbox (no
    // allowances, null origin). A remote `uri` (e.g. the perawallet.app terms
    // fallback when remote-config is ahead of the bundled copy) needs
    // `allow-same-origin allow-scripts` to actually render: without them the
    // frame gets a null origin, which the page's own X-Frame-Options/
    // frame-ancestors checks reject, and any JS it needs won't run. This is
    // no more permissive than an ordinary cross-origin iframe — the page
    // still runs in ITS OWN origin, isolated from the extension by normal
    // browser cross-origin rules, and cannot reach the chrome-extension://
    // DOM or APIs.
    const sandbox = isBundled ? '' : 'allow-same-origin allow-scripts'

    return (
        <PWView style={styles.webView}>
            <IFrame
                {...frameProps}
                sandbox={sandbox}
                title='static-content'
                // Raw DOM element rendered via react-dom, not an RN View:
                // makeStyles produces RN stylesheet ids that a host
                // <iframe> can't consume.
                // oxlint-disable-next-line react-native/no-inline-styles
                style={{ border: 0, width: '100%', height: '100%', flex: 1 }}
            />
        </PWView>
    )
}
