import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { sendShouldRefreshRequest } from './endpoints'
import { useMutation } from '@tanstack/react-query'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { usePollingStore } from '../store'

export const useShouldRefreshMutation = () => {
    const { network } = useNetwork()
    const accounts = useAllAccounts()
    const lastRefreshedRound = usePollingStore(
        state => state.lastRefreshedRound,
    )
    return useMutation({
        mutationFn: () =>
            sendShouldRefreshRequest(
                network,
                accounts.map(a => a.address),
                lastRefreshedRound,
            ),
    })
}
