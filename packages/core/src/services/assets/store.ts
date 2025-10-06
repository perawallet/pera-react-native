import type { StateCreator } from 'zustand'

export type AssetsSlice = {
    assetIDs: number[]
    setAssetIDs: (ids: number[]) => void
}

export const createAssetsSlice: StateCreator<
    AssetsSlice,
    [],
    [],
    AssetsSlice
> = set => {
    return {
        assetIDs: [],
        setAssetIDs: ids => set({ assetIDs: ids }),
    }
}

export const partializeAssetsSlice = (state: AssetsSlice) => {
    return {
        assetIDs: state.assetIDs,
    }
}
