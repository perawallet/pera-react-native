import PeraView from "../common/view/PeraView"
import { formatRelativeTime, NotificationV2SerializerResponse } from "@perawallet/core"
import { Image, Text, useTheme } from "@rneui/themed"
import { useStyles } from "./styles"
import { useMemo } from "react"
import { TouchableOpacity } from "react-native"
import BellIcon from '../../../assets/icons/bell.svg';

type NotificationItemProps = {
    item: NotificationV2SerializerResponse
}

const NotificationItem = ({ item }: NotificationItemProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    const getImage = (item: NotificationV2SerializerResponse) => {
        const metadata = item.metadata as any
        const imageUrl = metadata?.image_url ?? metadata?.asset?.logo ?? metadata?.icon?.logo

        if (imageUrl) {
            return <PeraView style={styles.iconContainerNoBorder}>
                {metadata?.icon?.shape === 'circle' ? 
                    <Image source={{uri: imageUrl }} containerStyle={styles.imageCircle} PlaceholderContent={<BellIcon color={theme.colors.textGray} />} transition />
                    : <Image source={{uri: imageUrl }} containerStyle={styles.image} PlaceholderContent={<BellIcon color={theme.colors.textGray} />} transition />
                }
            </PeraView>
        } else {
            return <PeraView style={styles.iconContainer}><BellIcon color={theme.colors.textGray} /></PeraView>
        }
    }

    const handlePress = () => {
        //TODO: we need to invoke relevant deeplinks here as we implement them
    }

    const image = useMemo(() => getImage(item), [item])

    return <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.container}>
        {image}
        <PeraView style={styles.messageBox}>
            <Text>{item.message}</Text>
            <Text style={styles.timeText}>{formatRelativeTime(item.creation_datetime ?? new Date())}</Text>
        </PeraView>
    </TouchableOpacity>
}

export default NotificationItem