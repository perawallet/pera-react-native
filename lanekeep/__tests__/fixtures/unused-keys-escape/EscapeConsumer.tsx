import { useMemo } from 'react'
import { useStyles } from './escape-styles'

export const EscapeConsumer = () => {
    const styles = useStyles()
    return useMemo(() => renderRow(styles), [styles])
}
