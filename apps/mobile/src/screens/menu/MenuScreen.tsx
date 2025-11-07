import MainScreenLayout from '../../layouts/MainScreenLayout';
import PeraView from '../../components/common/view/PeraView';
import { Text, useTheme } from '@rneui/themed';
import { TouchableOpacity } from 'react-native';
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

const MenuScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const goToSettings = () => {
    navigation.push('Settings');
  };

  return (
    <MainScreenLayout>
      <PeraView style={styles.iconBar}>
        <PeraView style={styles.iconBarColumn} />
        <Text h4 style={styles.iconBarColumn}>
          Menu
        </Text>
        <PeraView style={styles.iconBarColumn}>
          <TouchableOpacity>
            <CameraIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToSettings}>
            <GearIcon style={styles.icon} color={theme.colors.textMain} />
          </TouchableOpacity>
        </PeraView>
      </PeraView>

      <PeraView style={styles.menuContainer}>
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
          onPress={() => {}}
        />
      </PeraView>
    </MainScreenLayout>
  );
};

export default MenuScreen;
