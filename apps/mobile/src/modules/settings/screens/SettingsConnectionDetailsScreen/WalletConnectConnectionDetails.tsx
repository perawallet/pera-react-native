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

import { useLanguage } from '@hooks/useLanguage'
import type { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    ConnectionDetailsView,
    type ConnectionNetwork,
} from '@modules/connections/components/ConnectionDetailsView'
import { useSettingsWalletConnectDetailsScreen } from './useSettingsWalletConnectDetailsScreen'

export type WalletConnectConnectionDetailsProps = {
    clientId: string
}

const ALL_CHAIN_ID = 4160
const MAINNET_CHAIN_ID = 416001
const TESTNET_CHAIN_ID = 416002

/** WalletConnect branch of {@link SettingsConnectionDetailsScreen}. */
export const WalletConnectConnectionDetails = ({
    clientId,
}: WalletConnectConnectionDetailsProps) => {
    const { t } = useLanguage()

    const {
        session,
        peerMeta,
        preferredIcon,
        connectedAccounts,
        isLoading,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    } = useSettingsWalletConnectDetailsScreen(clientId)

    const accounts = (connectedAccounts ?? []).filter(
        (account): account is WalletAccount => Boolean(account),
    )

    const chainId = session.session?.chainId ?? ALL_CHAIN_ID
    const networks: ConnectionNetwork[] = []
    if (chainId === ALL_CHAIN_ID || chainId === MAINNET_CHAIN_ID) {
        networks.push('mainnet')
    }
    if (chainId === ALL_CHAIN_ID || chainId === TESTNET_CHAIN_ID) {
        networks.push('testnet')
    }

    return (
        <ConnectionDetailsView
            iconUri={preferredIcon}
            fallbackIconName='wallet-connect'
            name={peerMeta?.name ?? t('connected_apps.unknown_app')}
            subtitle={peerMeta?.url}
            onSubtitlePress={handleOpenLink}
            description={peerMeta?.description}
            versionBadge={`WCV${session?.version}`}
            versionText={t('walletconnect.settings.version', {
                version: session?.version,
            })}
            createdAt={session?.createdAt ?? new Date()}
            accounts={accounts}
            networks={networks}
            permissions={
                (session.session?.permissions ?? []) as AlgorandPermission[]
            }
            deleteModalState={deleteModalState}
            onDelete={handleDelete}
            isDeleting={isLoading}
            testIDPrefix='wallet_connect_details'
        />
    )
}
