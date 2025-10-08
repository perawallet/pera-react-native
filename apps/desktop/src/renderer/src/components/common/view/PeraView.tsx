import React from 'react'
import { StyledView } from './PeraView.styles'

export type PeraViewProps = React.HTMLAttributes<HTMLDivElement>

const PeraView = (props: PeraViewProps) => {
  return <StyledView {...props}>{props.children}</StyledView>
}

export default PeraView
