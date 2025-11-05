import PeraView from "../../common/view/PeraView"
import { useStyles } from "./styles";
import { Text, useTheme } from "@rneui/themed";
import CurrencyDisplay from "../../common/currency-display/CurrencyDisplay";
import Decimal from "decimal.js";
import AlgoIcon from "../../../../assets/icons/assets/algo.svg";
import { ViewProps } from "react-native";


type BalanceImpactViewProps = {
} & ViewProps

const AssetImpact = () => {
    const { theme } = useTheme()
    const styles = useStyles()

    return (
        <PeraView style={styles.itemContainer}>
            <AlgoIcon width={theme.spacing.xl * 2} height={theme.spacing.xl * 2}/>
            <PeraView style={styles.amounts}>
                <CurrencyDisplay currency="ALGO" value={Decimal(200)} precision={2} showSymbol h3 />
                <CurrencyDisplay currency="USD" value={Decimal(12.74)} precision={2} showSymbol style={styles.secondaryAmount}/>
            </PeraView>
        </PeraView>
    )
}

const BalanceImpactView = (props: BalanceImpactViewProps) => {
    const styles = useStyles()

    return <PeraView style={styles.impactContainer}>
            <Text h4 h4Style={styles.impactHeading}>YOU WILL RECEIVE</Text>
            <AssetImpact />
            <AssetImpact />
            <Text h4 h4Style={styles.impactHeading}>YOU WILL SPEND</Text>
            <AssetImpact />
            <AssetImpact />
        </PeraView>
}

export default BalanceImpactView