import PeraButton from '../../common/button/PeraButton';
import PeraView from '../../common/view/PeraView';
import { Image, Text } from '@rneui/themed';
import { useStyles } from './styles';

import CardIcon from '../../../../assets/icons/card.svg';
import PlusIcon from '../../../../assets/icons/plus.svg';
import CardBackground from '../../../../assets/images/card-background.png';

const BACKGROUND_URI = Image.resolveAssetSource(CardBackground).uri;

const CardPanel = () => {
  const styles = useStyles();
  return (
    <PeraView style={styles.cardContainer}>
      <PeraView style={styles.cardHeaderContainer}>
        <PeraView style={styles.cardTextContainer}>
          <PeraView style={styles.titleContainer}>
            <CardIcon style={styles.icon} />
            <Text h3>Cards</Text>
          </PeraView>
          <Text style={styles.cardSecondaryText}>
            Get the world's first web3{'\n'}Mastercard.
          </Text>
        </PeraView>
        <PeraView style={styles.cardImageContainer}>
          <Image
            source={{ uri: BACKGROUND_URI }}
            style={styles.backgroundImage}
          />
        </PeraView>
      </PeraView>
      <PeraView style={styles.cardButtonContainer}>
        <PeraButton
          variant="primary"
          title={'Create Pera Card'}
          icon={<PlusIcon style={styles.buttonIcon} />}
        />
      </PeraView>
    </PeraView>
  );
};
export default CardPanel;
