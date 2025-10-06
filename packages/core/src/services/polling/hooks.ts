import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { useV1AccountsShouldRefreshCreate } from '../../api/generated/backend'
import { useQueryClient } from '@tanstack/react-query'

const CACHE_CHECK_INTERVAL = 3000

export const usePolling = () => {
    const accounts = useAppStore(state => state.accounts)
    const lastRefreshedRound = useAppStore(state => state.lastRefreshedRound)
    const setLastRefreshedRound = useAppStore(
        state => state.setLastRefreshedRound,
    )
    const { mutateAsync } = useV1AccountsShouldRefreshCreate()
    const queryClient = useQueryClient()
    const [polling, setPolling] = useState<NodeJS.Timeout | null>(null)

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
                //TODO: can we be a bit more selective of which queries we reset?
                //queryClient.resetQueries()
                setLastRefreshedRound(response.round ?? null)
            }
        } catch (error) {
            console.log('Polling failed:')
            console.log(error)
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
