import { WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'

const useSessionRequests = () => {
    const sessionRequests = useWalletConnectStore(
        state => state.sessionRequests,
    )
    const setSessionRequests = useWalletConnectStore(
        state => state.setSessionRequests,
    )

    const addSessionRequest = (request: WalletConnectSessionRequest) => {
        setSessionRequests([...sessionRequests, request])
    }

    const removeSessionRequest = (request: WalletConnectSessionRequest) => {
        setSessionRequests(sessionRequests.filter(r => r !== request))
    }

    return {
        sessionRequests,
        addSessionRequest,
        removeSessionRequest,
    }
}

export default useSessionRequests
