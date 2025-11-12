import { Skeleton } from "@rneui/themed"
import PWView from "../../common/view/PWView"
import { AccountDetailAssetSerializerResponse, PeraAsset, useAccountBalances, useSelectedAccount } from "@perawallet/core"
import { FlatList, ListRenderItemInfo } from "react-native"
import { useCallback, useContext, useMemo } from "react"
import AccountAssetItemView from "../../assets/asset-item/AccountAssetItemView"
import PWTouchableOpacity from "../../common/touchable-opacity/PWTouchableOpacity"
import { useStyles } from "./styles"
import Decimal from "decimal.js"
import { SendFundsContext } from "../../../providers/SendFundsProvider"

type SendFundsAssetSelectionViewProps = {
    onSelected: () => void
}

const LoadingView = () => {
    const styles = useStyles()
    return <PWView style={styles.loadingContainer}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
    </PWView>
}

const SendFundsAssetSelectionView = ({onSelected}: SendFundsAssetSelectionViewProps) => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { setSelectedAsset } = useContext(SendFundsContext)
    const { data, loading } = useAccountBalances(selectedAccount ? [selectedAccount] : [])

    const handleSelected = (item: PeraAsset) => {
        setSelectedAsset(item)
        onSelected()
    }

    const balanceData = useMemo(() => data.at(0)?.accountInfo?.results, [data])
    const renderItem = useCallback(({item}: ListRenderItemInfo<AccountDetailAssetSerializerResponse> ) => {
        return <PWTouchableOpacity onPress={() => handleSelected(item)}>
            <AccountAssetItemView asset={item} amount={item.amount ? Decimal(item.amount) : undefined} localAmount={item.balance_usd_value ? Decimal(item.balance_usd_value) : undefined} />
        </PWTouchableOpacity>
    }, [handleSelected])

    return <PWView style={styles.container}>
       {loading && <LoadingView />}
       {!loading && <FlatList style={styles.assetList} data={balanceData} contentContainerStyle={styles.assetListContainer} renderItem={renderItem} />}
    </PWView>
}

export default SendFundsAssetSelectionView
