import PWIcon, { IconName } from "../icons/PWIcon"
import PWTouchableOpacity, { PWTouchableOpacityProps } from "../touchable-opacity/PWTouchableOpacity"
import { Text } from "@rneui/themed"
import { useStyles } from "./styles"
import PWView from "../view/PWView"

type PWListItemProps = PWTouchableOpacityProps & {
    icon: IconName
    title: string
}

const PWListItem = ({ icon, title, ...props }: PWListItemProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.row}
            {...props}
        >
            <PWView style={styles.labelContainer}>
                <PWIcon name={icon} />
                <Text style={styles.title}>
                    {title}
                </Text>
            </PWView>
            <PWIcon
                name='chevron-right'
                variant='secondary'
            />
        </PWTouchableOpacity>
    )
}

export default PWListItem