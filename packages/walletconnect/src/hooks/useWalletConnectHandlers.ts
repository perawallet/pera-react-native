import { logger, Network, Networks } from "@perawallet/wallet-core-shared"
import { WalletConnectInvalidNetworkError, WalletConnectInvalidSessionError, WalletConnectSignRequestError } from "../errors"
import { useWalletConnectStore } from "../store"
import { useSigningRequest } from "@perawallet/wallet-core-blockchain"
import { useNetwork } from "@perawallet/wallet-core-platform-integration"
import WalletConnect from "@walletconnect/client"
import { useCallback } from "react"
import { WalletConnectSession } from "../models"

const validateRequest = (connector: WalletConnect, sessions: WalletConnectSession[], network: Network, error: Error | null) => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(error)
    }

    const existingSession = sessions.find(session => session.session?.clientId === connector.clientId)
    if (!existingSession || !existingSession.session) {
        logger.error("WC algo_signData received, but no session found")
        throw new WalletConnectInvalidSessionError(new Error("No session found"))
    }

    const { chainId } = existingSession.session

    if (chainId !== 4160
        && ((network === Networks.mainnet && chainId !== 416001)
            || (network === Networks.testnet && chainId !== 416002))) {
        logger.error("WC algo_signData received, but chainId doesn't match")
        throw new WalletConnectInvalidNetworkError()
    }
}

const useWalletConnectHandlers = () => {
    const sessions = useWalletConnectStore(state => state.walletConnectSessions)
    const { addSignRequest } = useSigningRequest()
    const { network } = useNetwork()

    const handleSignData = useCallback((connector: WalletConnect, error: Error | null, payload: any | null) => {
        logger.debug("WC algo_signData received", { error, payload })
        validateRequest(connector, sessions, network, error)

        const { message, data } = payload?.params?.at(0)

        if (!data) {
            logger.error("WC algo_signData received, but no data found")
            throw new WalletConnectSignRequestError(new Error("No data found"))
        }

        addSignRequest({
            type: "arbitrary-data",
            transport: "walletconnect",
            transportId: connector.clientId,
            message,
            addresses: connector.accounts,
            data,
        })
    }, [sessions, addSignRequest, network])

    const handleSignTransaction = useCallback((connector: WalletConnect, error: Error | null, payload: any | null) => {
        logger.debug("WC algo_signTxn received", { error, payload })
        validateRequest(connector, sessions, network, error)

        const existingSession = sessions.find(session => session.session?.clientId === connector.clientId)
        if (!existingSession) {
            logger.error("WC algo_signTxn received, but no session found")
            return
        }
        const { message, txn } = payload.params.at(0)
        addSignRequest({
            type: "transactions",
            transport: "walletconnect",
            transportId: connector.clientId,
            message,
            addresses: connector.accounts,
            txs: [txn],
        })
    }, [sessions, addSignRequest])

    return {
        handleSignData,
        handleSignTransaction
    }
}

export default useWalletConnectHandlers