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

import { useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useLiquidAuthStore,
    type LiquidAuthSession,
} from '@perawallet/wallet-core-liquid-auth'
import { useLiquidAuthConnect } from '@modules/connections/liquid-auth/hooks/useLiquidAuthConnect'
import { useModalState } from '@hooks/useModalState'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'

type ModalState = ReturnType<typeof useModalState>
type Account = ReturnType<typeof useAllAccounts>[number]

export type UseSettingsLiquidAuthDetailsScreenResult = {
    session?: LiquidAuthSession
    connectedAccounts: Account[]
    deleteModalState: ModalState
    handleDelete: () => void
    handleOpenLink: () => void
}

export const useSettingsLiquidAuthDetailsScreen = (
    sessionId: string,
): UseSettingsLiquidAuthDetailsScreenResult => {
    const navigation = useNavigation()
    const sessions = useLiquidAuthStore(state => state.sessions)
    const accounts = useAllAccounts()
    const { disconnect } = useLiquidAuthConnect()
    const deleteModalState = useModalState()
    const { pushWebView } = useWebView()

    const session = useMemo(
        () => sessions.find(item => item.sessionId === sessionId),
        [sessions, sessionId],
    )

    const connectedAccounts = useMemo<Account[]>(() => {
        if (!session) {
            return []
        }
        return session.accounts
            .map(address =>
                accounts.find(account => account.address === address),
            )
            .filter((account): account is Account => Boolean(account))
    }, [session, accounts])

    const handleDelete = () => {
        disconnect(sessionId)
        deleteModalState.close()
        navigation.goBack()
    }

    const handleOpenLink = () => {
        if (!session?.host) {
            return
        }
        pushWebView({
            id: generateOrderedUniqueId(),
            url: session.host,
        })
    }

    return {
        session,
        connectedAccounts,
        deleteModalState,
        handleDelete,
        handleOpenLink,
    }
}
