import { formatCurrency, PeraAsset, useSelectedAccount } from "@perawallet/core"
import PWBottomSheet from "../../common/bottom-sheet/PWBottomSheet"
import EmptyView from "../../common/empty-view/EmptyView"
import SendFundsAssetSelectionView from "../asset-selection/SendFundsAssetSelectionView"
import SendFundsInputView from "../input-view/SendFundsInputView"
import PWView from "../../common/view/PWView"

import CrossIcon from "../../../../assets/icons/cross.svg"
import BackIcon from "../../../../assets/icons/chevron-left.svg"
import InfoIcon from "../../../../assets/icons/info.svg"
import { useContext, useLayoutEffect, useState } from "react"
import PWTouchableOpacity from "../../common/touchable-opacity/PWTouchableOpacity"
import { useStyles } from "./styles"
import { useWindowDimensions } from "react-native"
import { Text, useTheme } from "@rneui/themed"
import AccountDisplay from "../../common/account-display/AccountDisplay"
import SendFundsSelectDestination from "../select-destination/SendFundsSelectDestination"
import SendFundsTransactionConfirmation from "../transaction-confirmation/SendFundsTransactionConfirmation"
import SendFundsProvider, { SendFundsContext } from "../../../providers/SendFundsProvider"
import AssetIcon from "../../common/asset-icon/AssetIcon"
import useToast from "../../../hooks/toast"

type SendFundsBottomSheetProps = {
    asset?: PeraAsset
    isVisible: boolean
    onClose: () => void
}
type TitleComponentProps = {
    screenState: ScreenState
    handleBack: () => void
}

type ScreenState = "select-asset" | "input-amount" | "select-destination" | "confirm-transaction"

const TitleComponent = ({screenState, handleBack} : TitleComponentProps) => {
    const { theme } = useTheme()
    const selectedAccount = useSelectedAccount()
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { canSelectAsset, selectedAsset } = useContext(SendFundsContext)
    return <PWView style={styles.titleContainer}>
        <PWTouchableOpacity style={styles.titleButtonContainer} onPress={handleBack}>
            {screenState === 'select-asset' || (screenState === 'input-amount' && !canSelectAsset) ? <CrossIcon /> : <BackIcon />}
        </PWTouchableOpacity>
        {screenState === 'select-asset' &&
            <Text h4>Select Asset</Text>
        }
        {screenState === 'input-amount' &&
            <PWView style={styles.accountTitleContainer}>
                <Text>Send {selectedAsset?.name}</Text>
                <AccountDisplay account={selectedAccount ?? undefined} style={styles.accountDisplay} 
                    iconProps={{width: 16, height: 16}}
                    textProps={{style: styles.accountDisplaySubHeading}}
                    showChevron={false} />
            </PWView>
        }
        {screenState === 'select-destination' &&
            <PWView style={styles.assetTitleContainer}>
                <AssetIcon asset={selectedAsset} size={theme.spacing.xl} />
                <Text>{selectedAsset?.name}</Text>
            </PWView>
        }
        {screenState === 'confirm-transaction' &&
            <Text h4>Confirm Transaction</Text>
        }
        <PWView style={styles.titleButtonContainer}>
            {screenState === 'input-amount' && <InfoIcon />}
        </PWView>
    </PWView>
}

//TODO: add support for ASA Inbox sends (check whether destination account is opted into asset)
const SendFundsBottomSheet = ({asset, onClose, isVisible}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const [screenState, setScreenState] = useState<ScreenState>("select-asset")
    const dimensions = useWindowDimensions();
    const styles = useStyles(dimensions)
    const { canSelectAsset, setSelectedAsset, 
        setCanSelectAsset, setNote, setAmount, setDestination } = useContext(SendFundsContext)
    const { showToast } = useToast()

    useLayoutEffect(() => {
        if (asset) {
            setSelectedAsset(asset)
            setCanSelectAsset(false)
            setScreenState("input-amount")
        }
    }, [asset])

    const handleNext = () => {
        if (screenState === 'select-asset') {
            setScreenState('input-amount')
        } else if (screenState === 'input-amount') {
            setScreenState('select-destination')
        } else if (screenState === 'select-destination') {
            setScreenState('confirm-transaction')
        } else {
            clearContext()
            onClose()
        }
    }

    const handleBack = () => {
        if (screenState === 'input-amount' && canSelectAsset) {
            setScreenState('select-asset')
        } else if (screenState === 'select-destination') {
            setScreenState('input-amount')
        } else if (screenState === 'confirm-transaction') {
            setScreenState('select-destination')
        } else {
            clearContext()
            onClose()
        }
    }

    const clearContext = () => {
        setNote(undefined)
        setAmount(undefined)
        setDestination(undefined)
    }

    return <PWBottomSheet isVisible={isVisible} innerContainerStyle={styles.container}>
        <SendFundsProvider>
            <TitleComponent screenState={screenState} handleBack={handleBack} />
            {!!selectedAccount ? 
                <>
                    {screenState === 'select-asset' && <SendFundsAssetSelectionView onSelected={handleNext}/>}
                    {screenState === 'input-amount' && <SendFundsInputView onNext={handleNext}/>}
                    {screenState === 'select-destination' && <SendFundsSelectDestination onNext={handleNext}/>}
                    {screenState === 'confirm-transaction' && <SendFundsTransactionConfirmation onNext={handleNext} />}
                </>
                : <EmptyView title="No Account Selected" body="No account has been selected, please select an account first" />
            }
        </SendFundsProvider>
    </PWBottomSheet>
}

export default SendFundsBottomSheet
