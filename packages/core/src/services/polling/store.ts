import type { StateCreator } from 'zustand'

export type PollingSlice = {
    lastRefreshedRound: number | null
    setLastRefreshedRound: (round: number | null) => void
}

export const createPollingSlice: StateCreator<
    PollingSlice,
    [],
    [],
    PollingSlice
> = set => {
    return {
        lastRefreshedRound: null,
        setLastRefreshedRound: round => set({ lastRefreshedRound: round }),
    }
}

export const partializePollingSlice = (state: PollingSlice) => {
    return {
        lastRefreshedRound: state.lastRefreshedRound,
    }
}
