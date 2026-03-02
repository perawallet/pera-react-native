import { useNetwork } from "@perawallet/wallet-core-platform-integration"
import { logger } from "@perawallet/wallet-core-shared"
import { useWalletConnect, useWalletConnectSessionRequests, WalletConnectSessionRequest } from "@perawallet/wallet-core-walletconnect"
import { useCallback, useEffect, useState } from "react"

export const useWalletConnectProvider = () => {
    const { sessionRequests, removeSessionRequest } =
        useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const [successRequest, setSuccessRequest] =
        useState<WalletConnectSessionRequest | null>(null)
    const [connectionError, setConnectionError] = useState<Error | null>(null)
    const { network } = useNetwork()

    const handleSigningError = useCallback((error: Error) => {
        logger.debug('Handling Error')
        setConnectionError(error)
    }, [])

    const handleSuccess = (request: WalletConnectSessionRequest) => {
        setSuccessRequest(request)
    }

    const clearSuccessRequest = () => {
        setSuccessRequest(null)
    }

    const handleConnectionError = (error?: Error) => {
        if (error) {
            setConnectionError(error)
        }
    }

    const clearConnectionError = () => {
        if (nextRequest) {
            removeSessionRequest(nextRequest)
        }
        setConnectionError(null)
    }

    const { initWalletConnect } = useWalletConnect(network, {
        onError: handleSigningError,
    })

    useEffect(() => {
        logger.debug("[WC] Noticed network change.  Reconnecting")
        initWalletConnect()
    }, [initWalletConnect, network])

    return { 
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
        clearSuccessRequest,
        clearConnectionError
    }
}