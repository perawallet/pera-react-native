import { makeStyles } from '@rneui/themed'

const useLocalStyles = makeStyles(() => ({
    localUsed: { flex: 1 },
    localUnread: { flex: 1 },
}))

export const LocalHook = () => {
    const styles = useLocalStyles()
    return styles.localUsed
}
