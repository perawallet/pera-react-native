import PeraButton from "../../../components/button/PeraButton"
import PeraView from "../../../components/view/PeraView"
import { Text } from "@rneui/themed"
import { useStyles } from './styles'

import CardIcon from '../../../../assets/icons/card.svg'
import PlusIcon from '../../../../assets/icons/plus.svg'
import CardBackground from '../../../../assets/images/card-background.svg'

const CardPanel = () => {
    const styles = useStyles();
    return (
        <PeraView style={styles.cardContainer}>
            <PeraView style={styles.cardHeaderContainer}>
                <PeraView style={styles.cardTextContainer}>
                    <PeraView style={styles.titleContainer}>
                        <CardIcon style={styles.icon}/> 
                        <Text h3>
                            Cards
                        </Text>
                    </PeraView>
                    <Text style={styles.cardSecondaryText}>
                        Get the world's first web3{"\n"}Mastercard.
                    </Text>
                </PeraView>
                <PeraView style={styles.cardImageContainer}>
                    <CardBackground />
                </PeraView>
            </PeraView>
            <PeraView style={styles.cardButtonContainer}>
                <PeraButton variant='primary' title={'Create Pera Card'} icon={<PlusIcon style={styles.buttonIcon} />} />
            </PeraView>
        </PeraView> 
    )
}
export default CardPanel
