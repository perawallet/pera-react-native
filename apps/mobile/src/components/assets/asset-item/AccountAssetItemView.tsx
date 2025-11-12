import AssetIcon from "../../common/asset-icon/AssetIcon"
import CurrencyDisplay from "../../common/currency-display/CurrencyDisplay"
import PWView, { PWViewProps } from "../../common/view/PWView"
import { ALGO_ASSET_ID, PeraAsset } from "@perawallet/core"
import { Text, useTheme } from "@rneui/themed"
import Decimal from "decimal.js"
import { useStyles } from "./styles"

type AccountAssetItemViewProps = {
    asset: PeraAsset
    amount?: Decimal
    localAmount?: Decimal
    iconSize?: number
} & PWViewProps

const AccountAssetItemView = ({ asset, amount, localAmount, iconSize, ...rest}: AccountAssetItemViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    return <PWView {...rest} style={[styles.container, rest.style]}>
        <AssetIcon asset={asset} size={iconSize ?? theme.spacing.xl * 1.5} />
        <PWView style={styles.dataContainer}>
            <PWView style={styles.unitContainer}>
                <Text style={styles.primaryUnit}>{asset.name}</Text>
                <Text style={styles.secondaryUnit}>{asset.unit_name}{asset.asset_id !== ALGO_ASSET_ID && ` - ${asset.asset_id}`}</Text>
            </PWView>
            {!!amount && !!localAmount && <PWView style={styles.amountContainer}>
                <CurrencyDisplay currency={asset.unit_name} value={amount} precision={6} showSymbol style={styles.primaryAmount} />
                {/* TODO support currencies */}
                <CurrencyDisplay currency={"USD"} value={localAmount} precision={6} showSymbol style={styles.secondaryAmount} />
            </PWView>}
        </PWView>
    </PWView>
}

export default AccountAssetItemView
