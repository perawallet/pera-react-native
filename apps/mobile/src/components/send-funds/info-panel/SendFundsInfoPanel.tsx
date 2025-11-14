import PWBottomSheet, { PWBottomSheetProps } from "../../common/bottom-sheet/PWBottomSheet"
import { usePreferences } from "@perawallet/core"
import { Text, useTheme } from "@rneui/themed"
import { useEffect, useState } from "react"
import InfoIcon from '../../../../assets/icons/info.svg'
import PWButton from "../../common/button/PWButton"
import { UserPreferences } from "../../../constants/user-references"
import { useStyles } from "./styles"
import PWView from "../../common/view/PWView"
import PWTouchableOpacity from "../../common/touchable-opacity/PWTouchableOpacity"

type SendFundsInfoPanelProps = {
    onClose: () => void
} & PWBottomSheetProps

const TIPS = [
    ""
]

const SendFundsInfoPanel = ({ isVisible, onClose, ...rest } : SendFundsInfoPanelProps) => {
    const styles = useStyles()
    const { getPreference, setPreference } = usePreferences()
    const { theme } = useTheme()
    const [forceOpen, setForceOpen] = useState(false)

    useEffect(() => {
        const hasAgreed = getPreference(UserPreferences.spendAgreed)
        if (!hasAgreed) {
            setTimeout(() => {
                setForceOpen(true)
            }, 300)
        }
    }, [getPreference])

    const handleClose = () => {
        setPreference(UserPreferences.spendAgreed, true)
        onClose()
    }

    return <PWBottomSheet isVisible={isVisible || forceOpen} {...rest} innerContainerStyle={styles.container}>
        <InfoIcon width={theme.spacing.xl * 3} height={theme.spacing.xl * 3} color={theme.colors.helperPositive} />
        <PWView style={styles.bodyContainer}>
            <Text h3 h3Style={styles.title}>Transacting Tips</Text>
            <Text style={styles.preamble}>
                Before you finalize your transaction keep in mind a couple of tips
            </Text>
            <PWView style={styles.tipsContainer}>
                <PWView style={styles.tip}>
                   <PWView style={styles.tipNumberContainer}><Text style={styles.tipNumber}>1</Text></PWView> 
                    <Text style={styles.tipText}>
                        When sending to an address for the first time, it's useful to send a small
                        test transaction before sending a large amount.
                    </Text>
                </PWView>
                <PWView style={styles.tip}>
                   <PWView style={styles.tipNumberContainer}><Text style={styles.tipNumber}>2</Text></PWView> 
                    <Text style={styles.tipText}>
                        Exchanges chnge their deposit addresses frequently and saved exchange addresses may
                        no longer be in use. <Text style={styles.redText}>Ensure you're sending to the correct address.</Text>
                    </Text>
                </PWView>
            </PWView>
            {/* TODO implement link */}
            <Text style={styles.postamble}>For more information on transacting <Text style={styles.link}>tap here</Text></Text>
            <PWButton variant="tertiary" onPress={handleClose} title="I Understand" />
        </PWView>
    </PWBottomSheet>

}

export default SendFundsInfoPanel