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

import MainScreenLayout from '../../layouts/MainScreenLayout';
import PWView from '../../components/common/view/PWView';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';

import CameraIcon from '../../../assets/icons/camera.svg';
import GearIcon from '../../../assets/icons/gear.svg';
import ChevronRight from '../../../assets/icons/chevron-right.svg';
import CardStackIcon from '../../../assets/icons/card-stack.svg';
import AlgoIcon from '../../../assets/icons/algo.svg';
import InflowIcon from '../../../assets/icons/inflow.svg';
import PersonMenuIcon from '../../../assets/icons/person-menu.svg';

import PanelButton from '../../components/common/panel-button/PanelButton';
import CardPanel from '../../components/cards/card-panel/CardPanel';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PWTouchableOpacity from '../../components/common/touchable-opacity/PWTouchableOpacity';

const MenuScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const goToSettings = () => {
    navigation.push('Settings');
  };

  const goToContacts = () => {
    navigation.push('Contacts');
  };

  return (
    <MainScreenLayout>
      <PWView style={styles.iconBar}>
        <PWView style={styles.iconBarColumn} />
        <Text h4 style={styles.iconBarColumn}>
          Menu
        </Text>
        <PWView style={styles.iconBarColumn}>
          <PWTouchableOpacity>
            <CameraIcon style={styles.icon} color={theme.colors.textMain} />
          </PWTouchableOpacity>
          <PWTouchableOpacity onPress={goToSettings}>
            <GearIcon style={styles.icon} color={theme.colors.textMain} />
          </PWTouchableOpacity>
        </PWView>
      </PWView>

      <PWView style={styles.menuContainer}>
        <CardPanel />
        <PanelButton
          title="NFTs"
          titleWeight="h3"
          leftIcon={<CardStackIcon style={styles.icon} />}
          rightIcon={<ChevronRight style={styles.icon} />}
          onPress={() => {}}
        />
        <PanelButton
          title="Buy ALGO"
          titleWeight="h3"
          leftIcon={<AlgoIcon style={styles.icon} />}
          rightIcon={<ChevronRight style={styles.icon} />}
          onPress={() => {}}
        />
        <PanelButton
          title="Receive"
          titleWeight="h3"
          leftIcon={<InflowIcon style={styles.icon} />}
          rightIcon={<ChevronRight style={styles.icon} />}
          onPress={() => {}}
        />
        <PanelButton
          title="Contacts"
          titleWeight="h3"
          leftIcon={<PersonMenuIcon style={styles.icon} />}
          rightIcon={<ChevronRight style={styles.icon} />}
          onPress={goToContacts}
        />
      </PWView>
    </MainScreenLayout>
  );
};

export default MenuScreen;
