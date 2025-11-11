/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
