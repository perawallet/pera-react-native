import {
    PWBadge,
    PWButton,
    PWIcon,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import {
    AlgorandChain,
    AlgorandPermission,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { PermissionItem } from '../PermissionItem'

export type ConnectionViewHeaderProps = {
    request: WalletConnectSessionRequest
}

export const ConnectionViewHeader = ({
    request,
}: ConnectionViewHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const preferredIcon =
        request.peerMeta.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? request.peerMeta.icons?.at(0)

    const handlePressUrl = () => {
        if (!request.peerMeta.url) return
        pushWebView({
            id: generateOrderedUniqueId(),
            url: request.peerMeta.url,
        })
    }

    return (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {request.chainId !== 4160 ? (
                    <PWBadge
                        value={t(
                            `walletconnect.request.networks_${AlgorandChain[request.chainId]}`,
                        )}
                        variant={
                            request.chainId === 416002 ? 'testnet' : 'primary'
                        }
                    />
                ) : (
                    <>
                        <PWBadge
                            value={t(`walletconnect.request.networks_mainnet`)}
                            variant='primary'
                        />
                        <PWBadge
                            value={t(`walletconnect.request.networks_testnet`)}
                            variant='testnet'
                        />
                    </>
                )}
            </PWView>
            {preferredIcon ? (
                <PWImage
                    source={{ uri: preferredIcon }}
                    style={styles.icon}
                />
            ) : (
                <PWView style={styles.iconContainer}>
                    <PWIcon
                        name='wallet-connect'
                        variant='secondary'
                        size='xl'
                    />
                </PWView>
            )}
            <PWView style={styles.titleContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('walletconnect.request.title', {
                        name: request.peerMeta.name,
                    })}
                </PWText>
                {!!request.peerMeta.url && (
                    <PWButton
                        variant='link'
                        onPress={handlePressUrl}
                        title={request.peerMeta.url}
                    />
                )}
            </PWView>

            <PWView style={styles.permissionsContainer}>
                <PWText
                    variant='h4'
                    style={styles.permissionsTitle}
                >
                    {t('walletconnect.request.permissions_title')}
                </PWText>
                {request.permissions.map((permission, index) => (
                    <PermissionItem
                        key={index}
                        permission={permission as AlgorandPermission}
                    />
                ))}
            </PWView>

            <PWView style={styles.accountSelectionContainer}>
                <PWText
                    variant='h4'
                    style={styles.permissionsTitle}
                >
                    {t('walletconnect.request.accounts_title')}
                </PWText>
            </PWView>
        </PWView>
    )
}
