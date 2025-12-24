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

import { PERA_CLIENT_META } from '../constants'
import { WalletConnectInvalidSessionError } from '../errors'
import { WalletConnectSession } from '../models'
import { useWalletConnectStore } from '../store'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import { useWalletConnectSessionRequests } from './useWalletConnectSessionRequests'
import { useSigningRequest } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'

const connectors = new Map<string, WalletConnect>()

export const useWalletConnect = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const setSessions = useWalletConnectStore(
        state => state.setWalletConnectSessions,
    )
    const { addSessionRequest } = useWalletConnectSessionRequests()
    const { addSignRequest } = useSigningRequest()

    const connectSession = useCallback(async ({ session }: { session: WalletConnectSession }) => {

        const connector = new WalletConnect({
            ...session,
            clientMeta: PERA_CLIENT_META
        })

        //TODO set this up properly, also we need to make sure it continues to work
        //if addSessionRequest changes...
        connector.on("algo_signData", (error, payload) => {
            if (error) {
                logger.error(error)
                return
            }
            addSignRequest({
                type: "arbitrary-data",
                transport: "walletconnect",
                transportId: connector.clientId,
                data: payload.params.data,
            })
        })
        connector.on("algo_signTxn", (error, payload) => {
            if (error) {
                logger.error(error)
                return
            }
            addSignRequest({
                type: "transactions",
                transport: "walletconnect",
                transportId: connector.clientId,
                txs: [payload.params.data],
            })
        })
        connector.on("disconnect", () => {
            disconnectSession(connector.clientId)
        })
        connector.on("session_proposal", (error, payload) => {
            if (error) {
                logger.error(error)
                return
            }
            addSessionRequest({
                peerMeta: payload.params.peerMeta,
                chainId: payload.params.chainId,
                permissions: payload.params.permissions,
                clientId: connector.clientId,
            })
        })

        await connector.connect()
        connectors.set(connector.clientId, connector)
    }, [addSessionRequest])

    const reconnectAllSessions = useCallback(() => {
        sessions.forEach(session => {
            connectSession({ session })
        })
    }, [connectSession])

    const disconnectSession = useCallback((clientId: string) => {
        const existingSession = sessions.find(session => session.session?.clientId === clientId)
        if (!existingSession) {
            return
        }

        const connector = connectors.get(clientId)
        if (!connector) {
            return
        }

        connector.transportClose()
        connectors.delete(clientId)

        setSessions(
            sessions.map(session =>
                session.session?.clientId === clientId ? { ...existingSession, ...connector.session } : session,
            ),
        )
        return existingSession
    }, [sessions])

    const approveSession = useCallback((clientId: string, chainId: number, addresses: string[]) => {
        let existingSession = sessions.find(session => session.session?.clientId === clientId)

        const connector = connectors.get(clientId)
        if (!connector) {
            throw new WalletConnectInvalidSessionError()
        }

        connector.approveSession({
            chainId,
            accounts: addresses,
        })

        setSessions(
            sessions.map(session =>
                session.session?.clientId === clientId ? {
                    ...existingSession,
                    lastActiveAt: new Date(),
                    ...connector.session
                } : session,
            ),
        )
    }, [sessions])

    const rejectSession = useCallback((clientId: string) => {
        const connector = connectors.get(clientId)
        if (!connector) {
            throw new WalletConnectInvalidSessionError()
        }

        connector.rejectSession()

        setSessions(
            sessions.filter(session => session.session?.clientId !== clientId)
        )
    }, [sessions])

    const removeSession = useCallback((clientId: string) => {
        disconnectSession(clientId)
        connectors.get(clientId)?.killSession()
        connectors.delete(clientId)
        setSessions(sessions.filter(session => session.session?.clientId !== clientId))
    }, [sessions])

    const clearSessions = useCallback(() => {
        sessions.forEach(session => {
            if (session.session?.clientId) {
                removeSession(session.session.clientId)
            }
        })
    }, [sessions])

    return {
        sessions,
        reconnectAllSessions,
        connectSession,
        disconnectSession,
        approveSession,
        rejectSession,
        removeSession,
        clearSessions,
    }
}
