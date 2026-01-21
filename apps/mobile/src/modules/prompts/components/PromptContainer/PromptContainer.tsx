import { usePromptContainer } from './usePromptContainer'
import { useCallback } from 'react'
import { useStyles } from './styles'
import { Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export const PromptContainer = () => {
    const styles = useStyles()
    const { nextPrompt, dismissPrompt, hidePrompt } = usePromptContainer()

    const handleDismiss = useCallback(
        () => dismissPrompt(nextPrompt?.id || ''),
        [dismissPrompt],
    )
    const handleHide = useCallback(
        () => hidePrompt(nextPrompt?.id || ''),
        [hidePrompt],
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
            <SafeAreaView style={styles.container}>
                <PromptComponent
                    onDismiss={handleDismiss}
                    onHide={handleHide}
                />
            </SafeAreaView>
        </Modal>
    )
}
