import PWView from "@components/view/PWView"
import { useWalletConnect, useWalletConnectSessionRequests, WalletConnectSessionRequest } from "@perawallet/wallet-core-walletconnect"
import { Image, Text } from "@rneui/themed"
import { useStyles } from "./styles"
import PWBadge from "@components/badge/PWBadge"
import { useLanguage } from "@hooks/language"
import React from "react"
import PWButton from "@components/button/PWButton"
import { useWebView } from "@hooks/webview"
import { v7 as uuid } from 'uuid'
import PWIcon from "@components/icons/PWIcon"
import { useTheme } from "@rneui/themed"
import { getAccountDisplayName, useAllAccounts } from "@perawallet/wallet-core-accounts"

const PermissionItem = ({ title }: { title: string }) => {
    const styles = useStyles()
    const { theme } = useTheme()
    return <PWView style={styles.permissionItemContainer}>
        <PWIcon name="check" variant="positive" />
        <Text>{title}</Text>
    </PWView>
}

//TODO implement account selection
//TODO hook up wallet connect approvals correctly
//TODO implement chain ID display correctly
const ConnectionView = ({ request }: { request: WalletConnectSessionRequest }) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { removeSessionRequest } = useWalletConnectSessionRequests()
    const { approveSession, removeSession } = useWalletConnect()
    const accounts = useAllAccounts()

    const handlePressUrl = () => {
        if (!request.url) return
        pushWebView({ id: uuid(), url: request.url })
    }

    const handleCancel = () => {
        removeSession(request.connectionId)
        removeSessionRequest(request)
    }

    const handleConnect = () => {
        approveSession(request.connectionId)
        removeSessionRequest(request)
    }

    const getPermissionTitle = (permission: string) => {
        switch (permission) {
            case 'algo_signTxn':
                return t('walletconnect.request.permissions_sign_transaction')
            case 'algo_signData':
                return t('walletconnect.request.permissions_sign_data')
            default:
                return permission
        }
    }

    return <PWView style={styles.container}>
        <PWView style={styles.headerContainer}>
            <PWView style={styles.networksContainer}>
                {request.chainIds.map(chainId =>
                    <PWBadge key={chainId} value={chainId.toString()} />)}
            </PWView>
            {request.icons?.at(0) ?
                <Image source={{ uri: request.icons?.at(0) }} style={styles.icon} /> : <PWView style={styles.iconContainer}><PWIcon name="wallet-connect" variant="secondary" size='lg' /></PWView>}
            <PWView style={styles.titleContainer}>
                <Text h3 h3Style={styles.title}>{t('walletconnect.request.title', { name: request.name })}</Text>
                {!!request.url && <PWButton variant="link" onPress={handlePressUrl} title={request.url} />}
            </PWView>
        </PWView>
        <PWView style={styles.permissionsContainer}>
            <Text h4 h4Style={styles.permissionsTitle}>{t('walletconnect.request.permissions_title')}</Text>
            <PermissionItem title={t('walletconnect.request.permissions_request_accounts')} />
            {request.permissions.map((permission, index) =>
                <PermissionItem key={index} title={getPermissionTitle(permission)} />
            )}
        </PWView>

        <PWView style={styles.accountSelectionContainer}>
            <Text h4 h4Style={styles.permissionsTitle}>{t('walletconnect.request.accounts_title')}</Text>
            <PWView style={styles.accountsContainer}>
                {accounts.map((account, index) =>
                    <Text key={index}>{getAccountDisplayName(account)}</Text>
                )}
            </PWView>
        </PWView>

        <PWView style={styles.buttonContainer}>
            <PWButton variant="secondary" title={t('common.cancel.label')} onPress={handleCancel} style={styles.cancelButton} />
            <PWButton variant="primary" title={t('common.connect.label')} onPress={handleConnect} style={styles.connectButton} />
        </PWView>
    </PWView>
}

export default ConnectionView
