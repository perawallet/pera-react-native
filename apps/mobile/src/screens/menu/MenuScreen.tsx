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
import EnvelopeIcon from '../../../assets/icons/envelope-letter.svg';

import PanelButton from '../../components/common/panel-button/PanelButton';
import CardPanel from '../../components/cards/card-panel/CardPanel';
import { useAppStore } from '@perawallet/core';

const MenuScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();

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
          <TouchableOpacity>
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
          title="Invite Friends"
          titleWeight="h3"
          leftIcon={<EnvelopeIcon style={styles.icon} />}
          rightIcon={<ChevronRight style={styles.icon} />}
          onPress={() => {}}
        />
      </PeraView>
    </MainScreenLayout>
  );
};

export default MenuScreen;
