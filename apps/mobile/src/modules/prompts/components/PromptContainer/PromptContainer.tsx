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

import { useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWView } from '@components/core'
import { useBlockHardwareBack } from '@hooks/useBlockHardwareBack'
import { usePromptContainer } from './usePromptContainer'
import { useStyles } from './styles'

export const PromptContainer = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { nextPrompt, dismissPrompt, hidePrompt } = usePromptContainer()

    const handleDismiss = useCallback(
        () => dismissPrompt(nextPrompt?.id || ''),
        [dismissPrompt, nextPrompt?.id],
    )
    const handleHide = useCallback(
        () => hidePrompt(nextPrompt?.id || ''),
        [hidePrompt, nextPrompt?.id],
    )

    useBlockHardwareBack(!!nextPrompt)

    if (!nextPrompt) {
        return null
    }

    const PromptComponent = nextPrompt.component

    // accessibilityViewIsModal: a native Modal made siblings inaccessible for
    // free; this in-tree overlay must say so itself or VoiceOver swipes onto
    // the tab bar underneath. iOS only — Android (sibling subtrees must opt
    // out) and web (RNW drops this prop, and the removed Modal was the focus
    // trap) are both still open, tracked separately.
    return (
        <PWView
            accessibilityViewIsModal
            style={styles.overlay}
        >
            <PWView style={styles.stage}>
                <PWView style={styles.container}>
                    <PromptComponent
                        onDismiss={handleDismiss}
                        onHide={handleHide}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
