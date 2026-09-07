import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(() => ({
    selfUsed: { flex: 1 },
    selfUnused: { flex: 1 },
}))

export const SameFile = () => {
    const styles = useStyles()
    return styles.selfUsed
}
