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
import {
    ConnectionDetailsView,
    type ConnectionNetwork,
} from '@modules/connections/components/ConnectionDetailsView'
import { ALGORAND_GENESIS } from '@perawallet/wallet-core-liquid-auth'
import { LIQUID_AUTH_PERMISSIONS } from '@modules/connections/liquid-auth/constants'
import { faviconUrlForOrigin } from '@modules/connections/liquid-auth/faviconUrl'
import { useSettingsLiquidAuthDetailsScreen } from './useSettingsLiquidAuthDetailsScreen'

export type LiquidAuthConnectionDetailsProps = {
    sessionId: string
}

/** The host's domain stands in as the connection name (Liquid Auth has no dApp name). */
const hostnameOf = (host?: string): string | undefined =>
    host?.replace(/^https?:\/\//, '').replace(/[/?#].*$/, '') || undefined

/** Liquid Auth branch of {@link SettingsConnectionDetailsScreen}. */
export const LiquidAuthConnectionDetails = ({
    sessionId,
}: LiquidAuthConnectionDetailsProps) => {
    const { t } = useLanguage()
    const {
        session,
        connectedAccounts,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    } = useSettingsLiquidAuthDetailsScreen(sessionId)

    const networks: ConnectionNetwork[] =
        session?.genesisHash === ALGORAND_GENESIS.testnet.genesisHash
            ? ['testnet']
            : ['mainnet']

    return (
        <ConnectionDetailsView
            iconUri={faviconUrlForOrigin(session?.host)}
            fallbackIconName='globe'
            name={hostnameOf(session?.host) ?? t('connected_apps.unknown_app')}
            subtitle={session?.host}
            onSubtitlePress={handleOpenLink}
            versionBadge={t('connected_apps.badge_liquidauth')}
            versionText={t('liquidauth.settings.version')}
            createdAt={
                session?.createdAt ? new Date(session.createdAt) : new Date()
            }
            accounts={connectedAccounts}
            networks={networks}
            permissions={LIQUID_AUTH_PERMISSIONS}
            deleteModalState={deleteModalState}
            onDelete={handleDelete}
            testIDPrefix='liquid_auth_details'
        />
    )
}
