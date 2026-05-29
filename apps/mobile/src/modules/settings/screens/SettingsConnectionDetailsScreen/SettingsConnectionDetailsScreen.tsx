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

import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { WalletConnectSettingsStackParamsList } from '@modules/settings/routes'
import { WalletConnectConnectionDetails } from './WalletConnectConnectionDetails'
import { LiquidAuthConnectionDetails } from './LiquidAuthConnectionDetails'

export type SettingsConnectionDetailsScreenProps = NativeStackScreenProps<
    WalletConnectSettingsStackParamsList,
    'ConnectionDetails'
>

/**
 * Single Connected-App details screen for every connection protocol. Dispatches
 * on the discriminated route param to the matching protocol branch — each branch
 * owns its own data hook, so the divergent hooks stay rules-of-hooks-safe while
 * the shared presentation lives in `ConnectionDetailsView`.
 */
export const SettingsConnectionDetailsScreen = ({
    route,
}: SettingsConnectionDetailsScreenProps) => {
    const { params } = route

    return params.type === 'walletconnect' ? (
        <WalletConnectConnectionDetails clientId={params.clientId} />
    ) : (
        <LiquidAuthConnectionDetails sessionId={params.sessionId} />
    )
}
