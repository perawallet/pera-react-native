/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import PWButton from '@components/button/PWButton'
import EmptyView from '@components/empty-view/EmptyView'
import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'
import {
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSession,
} from '@perawallet/wallet-core-walletconnect'
import { Text } from '@rneui/themed'
import { FlashList } from '@shopify/flash-list'

//TODO implement session item
const WalletConnectSessionItem = ({
    session,
}: {
    session: WalletConnectSession
}) => {
    return (
        <PWView>
            <Text>{session.peerMeta.name}</Text>
        </PWView>
    )
}

const SettingsWalletConnectScreen = () => {
    const { t } = useLanguage()
    const { sessions } = useWalletConnect()

    const { addSessionRequest } = useWalletConnectSessionRequests()

    const handleScanQR = () => {
        addSessionRequest({
            connectionId: 'test',
            name: 'test',
            url: 'https://walletconnect.org',
            icons: [],
            chainId: 416001,
            permissions: ['algo_signTxn', 'algo_signData'],
        })
    }

    if (!sessions?.length) {
        return (
            <EmptyView
                icon='wallet-connect'
                title={t('walletconnect.settings.empty_title')}
                body={t('walletconnect.settings.empty_body')}
                button={
                    <PWButton
                        title={t('walletconnect.settings.empty_button')}
                        variant='primary'
                        onPress={handleScanQR}
                    />
                }
            />
        )
    }

    return (
        <PWView>
            <FlashList
                data={sessions}
                renderItem={({ item }) => (
                    <WalletConnectSessionItem session={item} />
                )}
            />
        </PWView>
    )
}

export default SettingsWalletConnectScreen
