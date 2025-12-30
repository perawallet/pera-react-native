import PWView from '@components/view/PWView'
import { RemoteConfigKeys } from '@perawallet/wallet-core-platform-integration'
import { Switch, Text } from '@rneui/themed'
import { useStyles } from './styles'
import { useRemoteConfigOverrides } from '@perawallet/wallet-core-platform-integration/src/remote-config/hooks/useRemoteConfigOverrides'

const FeatureFlagOverrides = () => {
    const styles = useStyles()
    const { configOverrides, setConfigOverride } = useRemoteConfigOverrides()

    const toggleOverride = (key: string) => {
        const value = configOverrides[key]
        if (value === undefined) {
            setConfigOverride(key, true)
        } else {
            setConfigOverride(key, null)
        }
    }

    return (
        <PWView style={styles.container}>
            {Object.values(RemoteConfigKeys).map(key => (
                <PWView
                    key={key}
                    style={styles.row}
                >
                    <Text>{key}</Text>
                    <Switch
                        value={configOverrides[key] === true}
                        onValueChange={() => toggleOverride(key)}
                    />
                </PWView>
            ))}
        </PWView>
    )
}

export default FeatureFlagOverrides
