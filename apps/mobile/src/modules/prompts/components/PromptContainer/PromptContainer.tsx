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

import { usePromptContainer } from './usePromptContainer'
import { useCallback } from 'react'
import { useStyles } from './styles'
import { Modal } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWView } from '@components/core'

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

    if (!nextPrompt) {
        return null
    }

    const PromptComponent = nextPrompt?.component

    return (
        <Modal
            visible={true}
            animationType='slide'
            statusBarTranslucent
            style={styles.modal}
        >
            <PWView style={styles.stage}>
                <GestureHandlerRootView style={styles.root}>
                    <PWView style={styles.container}>
                        <PromptComponent
                            onDismiss={handleDismiss}
                            onHide={handleHide}
                        />
                    </PWView>
                </GestureHandlerRootView>
            </PWView>
        </Modal>
    )
}
