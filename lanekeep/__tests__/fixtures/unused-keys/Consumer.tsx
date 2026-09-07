import { useStyles } from './styles'

export const Consumer = () => {
    const styles = useStyles()
    const { alsoUsed, renamed: r } = useStyles()
    return [styles.used, alsoUsed, r]
}
