export type PollingState = {
    lastRefreshedRound: number | null
    setLastRefreshedRound: (round: number | null) => void
}

export type ShouldRefreshResponse = {
    refresh: boolean
    round: number
}
