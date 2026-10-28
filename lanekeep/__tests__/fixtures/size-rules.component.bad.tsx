import React from 'react'
import { useTheme } from '@rneui/themed'
import { Icon, Spinner } from './icons'

const ICON_SIZE = 20

export function Bad({ width }: { width: number }) {
    const { theme } = useTheme()
    const qrSize = width - theme.spacing['5xl'] * 2
    return (
        <>
            <Icon
                width={16}
                height={16}
            />
            <Spinner size={24} />
            <Icon size={ICON_SIZE} />
            <Icon size={qrSize} />
        </>
    )
}
