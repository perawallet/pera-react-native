import { Text } from "@rneui/themed"

type TabLabelProps = {
    i18nKey: string
    color: string
}

const TabLabel = ({ i18nKey, color }: TabLabelProps) => {
    return (
        <Text style={{ color }}>{i18nKey}</Text>
    )
}

export default TabLabel
