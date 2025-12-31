import useToast from './toast'
import { useLanguage } from '@hooks/language'
import Clipboard from '@react-native-clipboard/clipboard'
import { useCallback } from 'react'

export const useClipboard = () => {
    const { showToast } = useToast()
    const { t } = useLanguage()

    const copyToClipboard = useCallback(
        (text: string) => {
            Clipboard.setString(text)
            showToast({
                title: t('common.copied_to_clipboard.title'),
                body: t('common.copied_to_clipboard.body'),
                type: 'success',
            })
        },
        [showToast, t],
    )

    return {
        copyToClipboard,
    }
}
