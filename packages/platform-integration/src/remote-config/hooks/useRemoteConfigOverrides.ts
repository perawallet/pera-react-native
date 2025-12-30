import { useRemoteConfigStore } from '../store'

export const useRemoteConfigOverrides = () => {
    const setConfigOverride = useRemoteConfigStore(
        state => state.setConfigOverride,
    )
    const configOverrides = useRemoteConfigStore(state => state.configOverrides)
    return {
        setConfigOverride,
        configOverrides,
    }
}
