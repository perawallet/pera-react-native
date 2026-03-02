import { PWBottomSheet, PWButton, PWIcon, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import { useStyles } from './styles'

type ConnectionSuccessBottomSheetProps = {
    onClose: () => void
    request: WalletConnectSessionRequest | null
}

export const ConnectionSuccessBottomSheet = ({
    onClose,
    request,
}: ConnectionSuccessBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const dAppName = request?.peerMeta.name ?? ''

    return (
        <PWBottomSheet
            isVisible={!!request}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='check'
                variant='primary'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('walletconnect.request.success_sheet_title', {
                    name: dAppName,
                })}
            </PWText>
            <PWText style={styles.message}>
                {t('walletconnect.request.success_sheet_body', {
                    name: dAppName,
                })}
            </PWText>
            <PWButton
                variant='secondary'
                title={t('common.close.label')}
                onPress={onClose}
            />
        </PWBottomSheet>
    )
}
