import { useState, useEffect } from 'react'
import { PWBottomSheet, PWButton, PWIcon, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { UserPreferences } from '@constants/user-preferences'
import { useStyles } from './styles'

export const TransactionRequestFAQBottomSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { pendingSignRequests } = useSigningRequest()
    const { getPreference, setPreference } = usePreferences()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (pendingSignRequests.length > 0) {
            const alreadyShown = getPreference(
                UserPreferences.transactionRequestFaqShown,
            )

            if (!alreadyShown) {
                deferToNextCycle(() => setIsVisible(true))
            }
        } else {
            setIsVisible(false)
        }
    }, [pendingSignRequests, getPreference])

    const handleClose = () => {
        setPreference(UserPreferences.transactionRequestFaqShown, true)
        setIsVisible(false)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={handleClose}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='info'
                variant='primary'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('signing.transaction_request_faq.title')}
            </PWText>
            <PWText style={styles.message}>
                {t('signing.transaction_request_faq.body')}
            </PWText>
            <PWText style={styles.warning}>
                {t('signing.transaction_request_faq.warning')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('common.close.label')}
                onPress={handleClose}
            />
        </PWBottomSheet>
    )
}
