import { useDeviceStore } from '../store'

export const useNetwork = () => {
    const { network, setNetwork } = useDeviceStore()
    return { network, setNetwork }
}
