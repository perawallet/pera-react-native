import { Skeleton } from "@rneui/themed"
import PWView from "../../common/view/PWView"
import { AccountDetailAssetSerializerResponse, PeraAsset, useAccountBalances, useSelectedAccount } from "@perawallet/core"
import { useCallback, useContext, useMemo } from "react"
import AccountAssetItemView from "../../assets/asset-item/AccountAssetItemView"
import PWTouchableOpacity from "../../common/touchable-opacity/PWTouchableOpacity"
import { useStyles } from "./styles"
import Decimal from "decimal.js"
import { SendFundsContext } from "../../../providers/SendFundsProvider"
import SendFundsTitlePanel from "../title-panel/SendFundsTitlePanel"

type SendFundsAssetSelectionViewProps = {
    onSelected: () => void
    onBack: () => void
}

const LoadingView = () => {
    const styles = useStyles()
    return <PWView style={styles.loadingContainer}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
    </PWView>
}

const SendFundsAssetSelectionView = ({onSelected, onBack}: SendFundsAssetSelectionViewProps) => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { setSelectedAsset } = useContext(SendFundsContext)
    const { data, loading } = useAccountBalances(selectedAccount ? [selectedAccount] : [])

    const handleSelected = (item: PeraAsset) => {
        setSelectedAsset(item)
        onSelected()
    }

    const balanceData = useMemo(() => data.at(0)?.accountInfo?.results, [data])
    const renderItem = useCallback((item: AccountDetailAssetSerializerResponse ) => {
        return <PWTouchableOpacity onPress={() => handleSelected(item)} key={`asset-${item.asset_id}`} style={styles.item}>
            <AccountAssetItemView asset={item} amount={item.amount ? Decimal(item.amount) : undefined} localAmount={item.balance_usd_value ? Decimal(item.balance_usd_value) : undefined} />
        </PWTouchableOpacity>
    }, [handleSelected, styles])

    return <PWView style={styles.container}>
        <SendFundsTitlePanel handleBack={onBack} screenState="select-asset" />
       {loading && <LoadingView />}
       {!loading && balanceData?.map(b => renderItem(b))}
    </PWView>
}

export default SendFundsAssetSelectionView
