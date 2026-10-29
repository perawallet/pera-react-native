import React from 'react'
import { useTheme } from '@rneui/themed'
import { Icon, Grid, Label } from './icons'

const GRID_IMAGE_WIDTH = 600

export function Good({ bottom }: { bottom: number }) {
    const { theme } = useTheme()
    return (
        <>
            <Icon
                width={theme.spacing.lg}
                height={0}
            />
            <Icon size='sm' />
            <Label numberOfLines={2} />
            <Grid imageWidth={GRID_IMAGE_WIDTH} />
            <Label paddingBottom={bottom + theme.spacing.md} />
            <Icon
                // lanekeep-ignore-next-line pera/no-numeric-sizes reason: artwork is a fixed 120pt
                width={120}
            />
        </>
    )
}
