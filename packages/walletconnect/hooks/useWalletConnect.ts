import { WalletConnectSession } from '../models'
import { useWalletConnectStore } from '../store'

const useWalletConnect = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const setSessions = useWalletConnectStore(state => state.setWalletConnectSessions)

    const reconnectAllSessions = () => {
        sessions.forEach(session => {
            connectSession(session)
        })
    }

    const connectSession = (session: WalletConnectSession) => {
        const existingSession = sessions.find(session => session.id === session.id) ?? session

        //TODO connect here

        setSessions(sessions.map(session => session.id === existingSession.id ? session : session))
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