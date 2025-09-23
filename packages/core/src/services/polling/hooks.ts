import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { useV1AccountsShouldRefreshCreate } from '../../api/generated/backend'

const CACHE_CHECK_INTERVAL = 3000

export const usePolling = () => {
    const accounts = useAppStore(state => state.accounts)
    const lastRefreshedRound = useAppStore(state => state.lastRefreshedRound)
    const setLastRefreshedRound = useAppStore(
        state => state.setLastRefreshedRound,
    )
    const { mutateAsync } = useV1AccountsShouldRefreshCreate()
    const [polling, setPolling] = useState<any>()

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const doCheck = async () => {
        try {
            if (!addresses.length) return
            const response = await mutateAsync({
                data: {
                    account_addresses: addresses,
                    last_refreshed_round: lastRefreshedRound,
                },
            })

            if (response.refresh) {
                //TODO: we need to reset any react queries that require refresh on next view here
                //queryClient.resetQueries()
                setLastRefreshedRound(response.round ?? null)
            }
        } catch (error) {
            console.log('Polling failed', error)
        }
    }

    const startPolling = async () => {
        const timer = setInterval(doCheck, CACHE_CHECK_INTERVAL)
        setPolling(timer)
    }

    const stopPolling = async () => {
        if (polling) {
            clearTimeout(polling)
            setPolling(null)
        }
    }

    return {
        startPolling,
        stopPolling,
    }
}
