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

import { WalletConnectSession, WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'

export const useWalletConnect = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const setSessions = useWalletConnectStore(
        state => state.setWalletConnectSessions,
    )

    const reconnectAllSessions = () => {
        sessions.forEach(session => {
            connectSession(session)
        })
    }

    const connectSession = (session: WalletConnectSession) => {
        const existingSession =
            sessions.find(session => session.id === session.id) ?? session

        //TODO connect websocket here
        existingSession.connected = true
        existingSession.lastActiveAt = new Date()
        setSessions(
            sessions.map(session =>
                session.id === existingSession.id ? existingSession : session,
            ),
        )
        return existingSession
    }

    const disconnectSession = (id: string) => {
        const existingSession = sessions.find(session => session.id === id)
        if (!existingSession) {
            return
        }

        if (!existingSession.connected) {
            return
        }

        //TODO disconnect websocket here
        existingSession.connected = false
        setSessions(
            sessions.map(session =>
                session.id === id ? existingSession : session,
            ),
        )
        return existingSession
    }

    const approveSession = (id: string, request: WalletConnectSessionRequest, addresses: string[]) => {
        let existingSession = sessions.find(session => session.id === id)
        if (!existingSession) {
            return
        }

        if (!existingSession.connected) {
            existingSession = connectSession(existingSession)
        }

        //TODO send subscription request and do the topic ID dance
        existingSession.subscribed = true
        existingSession.lastActiveAt = new Date()
        existingSession.walletMeta = {
            ...existingSession.walletMeta,
            permissions: request.permissions,
            chainId: request.chainId,
            addresses: addresses,
        }
        setSessions(
            sessions.map(session =>
                session.id === id ? existingSession : session,
            ),
        )
    }

    const removeSession = (id: string) => {
        disconnectSession(id)
        setSessions(sessions.filter(session => session.id !== id))
    }

    const clearSessions = () => {
        sessions.forEach(session => {
            removeSession(session.id)
        })
    }

    return {
        sessions,
        reconnectAllSessions,
        connectSession,
        disconnectSession,
        approveSession,
        removeSession,
        clearSessions,
    }
}
