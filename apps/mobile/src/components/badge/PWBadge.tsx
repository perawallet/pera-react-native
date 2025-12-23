import { Badge, BadgeProps } from "@rneui/themed"

type PWBadgeProps = BadgeProps

const PWBadge = ({
    ...rest
}: PWBadgeProps) => {
    return <Badge {...rest}></Badge>
}

export default PWBadge