import { Text } from "@rneui/themed"
import { useLanguage } from "../../hooks/useLanguage"
import { useStyles } from "./styles"

type TabLabelProps = {
    i18nKey: string
    active: boolean
}

const TabLabel = ({ i18nKey, active }: TabLabelProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    return (
        <Text style={active ? styles.active : styles.inactive}>{t(i18nKey)}</Text>
    )
}

export default TabLabel
