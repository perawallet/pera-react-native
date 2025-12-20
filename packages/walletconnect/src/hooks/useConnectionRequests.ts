import { WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'

const useConnectionRequests = () => {
    const connectionRequests = useWalletConnectStore(
        state => state.connectionRequests,
    )
    const setConnectionRequests = useWalletConnectStore(
        state => state.setConnectionRequests,
    )

    const addConnectionRequest = (request: WalletConnectSessionRequest) => {
        setConnectionRequests([...connectionRequests, request])
    }

    const removeConnectionRequest = (request: WalletConnectSessionRequest) => {
        setConnectionRequests(connectionRequests.filter(r => r !== request))
    }

    return {
        connectionRequests,
        addConnectionRequest,
        removeConnectionRequest,
    }
}

export default useConnectionRequests
