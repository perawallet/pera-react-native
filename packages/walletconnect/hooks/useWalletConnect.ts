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

import { WalletConnectSession } from '../models'
import { useWalletConnectStore } from '../store'

const useWalletConnect = () => {
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

        //TODO connect here

        setSessions(
            sessions.map(session =>
                session.id === existingSession.id ? session : session,
            ),
        )
    }

    const removeSession = (id: string) => {
        setSessions(sessions.filter(session => session.id !== id))
    }

    const clearSessions = () => {
        setSessions([])
    }

    return {
        sessions,
        addSession,
        removeSession,
        clearSessions,
    }
}
