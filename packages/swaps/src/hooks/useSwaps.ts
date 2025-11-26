import { useSwapsStore } from '../store'

export const useSwaps = () => {
    const { fromAsset, toAsset, setFromAsset, setToAsset } = useSwapsStore()

    return {
        fromAsset,
        toAsset,
        setFromAsset,
        setToAsset,
    }
}
