import type { StateCreator } from 'zustand'

export type SwapsSlice = {
    fromAsset: string
    toAsset: string
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string) => void
}

export const createSwapsSlice: StateCreator<
    SwapsSlice,
    [],
    [],
    SwapsSlice
> = set => {
    return {
        fromAsset: '0',
        toAsset: '1001',
        setFromAsset: (fromAsset: string) => set({ fromAsset }),
        setToAsset: (toAsset: string) => set({ toAsset }),
    }
}

export const partializeSwapsSlice = (state: SwapsSlice) => {
    return {
        fromAsset: state.fromAsset,
        toAsset: state.toAsset,
    }
}
