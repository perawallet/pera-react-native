export * from './assets'
export * from './price-history'

export type AssetsState = {
    assetIDs: string[]
    setAssetIDs: (ids: string[]) => void
}
