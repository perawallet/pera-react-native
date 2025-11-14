import AssetIcon from "../../common/asset-icon/AssetIcon"
import CurrencyDisplay from "../../common/currency-display/CurrencyDisplay"
import PWView, { PWViewProps } from "../../common/view/PWView"
import { ALGO_ASSET_ID, PeraAsset } from "@perawallet/core"
import { Text, useTheme } from "@rneui/themed"
import Decimal from "decimal.js"
import { useStyles } from "./styles"
import { useMemo } from "react"

import TrustedIcon from "../../../../assets/icons/assets/trusted.svg"
import VerifiedIcon from "../../../../assets/icons/assets/verified.svg"
import SuspiciousIcon from "../../../../assets/icons/assets/suspicious.svg"

type AccountAssetItemViewProps = {
    asset: PeraAsset
    amount?: Decimal
    localAmount?: Decimal
    iconSize?: number
} & PWViewProps

const AccountAssetItemView = ({ asset, amount, localAmount, iconSize, ...rest}: AccountAssetItemViewProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    const verificationIcon = useMemo(() => {
        if (asset.asset_id === ALGO_ASSET_ID) {
            return <TrustedIcon width={theme.spacing.md} height={theme.spacing.md} />
        }
        if (asset.verification_tier === "verified") {
            return <VerifiedIcon width={theme.spacing.md} height={theme.spacing.md}  />
        }
        if (asset.verification_tier === "suspicious") {
            return <SuspiciousIcon width={theme.spacing.md} height={theme.spacing.md}  />
        }
        return undefined
    }, [asset])

    return <PWView {...rest} style={[styles.container, rest.style]}>
        <AssetIcon asset={asset} size={iconSize ?? theme.spacing.xl * 1.5} />
        <PWView style={styles.dataContainer}>
            <PWView style={styles.unitContainer}>
                <PWView style={styles.row}>
                    <Text style={styles.primaryUnit}>{asset.name}</Text> {verificationIcon}
                </PWView>
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
