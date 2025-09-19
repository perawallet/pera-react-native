import PeraView from '../../components/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import BellIcon from '../../../assets/icons/bell.svg';
import InfoIcon from '../../../assets/icons/info.svg';

import CurrencyDisplay from '../../components/currency-display/CurrencyDisplay';
import ButtonPanel from '../../components/portfolio/button-panel/ButtonPanel';
import AccountList from '../../components/portfolio/account-list/AccountList';

const PortfolioScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();

  //TODO fetch this from server etc.
  const portfolioValue = '0';

  return (
    <MainScreenLayout>
      <PeraView style={styles.iconBar}>
        <TouchableOpacity>
          <CameraIcon style={styles.icon} color={theme.colors.textMain} />
        </TouchableOpacity>
        <TouchableOpacity>
          <BellIcon style={styles.icon} color={theme.colors.textMain} />
        </TouchableOpacity>
      </PeraView>
      <PeraView style={styles.valueTitleBar}>
        <Text h4Style={styles.valueTitle} h4>
          Portfolio Value
        </Text>
        <TouchableOpacity>
          <InfoIcon style={styles.icon} color={theme.colors.textGray} />
        </TouchableOpacity>
      </PeraView>
      <PeraView style={styles.valueBar}>
        <CurrencyDisplay
          h1
          value={portfolioValue}
          currencySymbol=""
          precision={2}
        />
        <CurrencyDisplay
          h4
          h4Style={styles.valueTitle}
          value={portfolioValue}
          currencySymbol="≈ $"
          precision={2}
        />
      </PeraView>

      {/* TODO: Render chart here... */}

      <ButtonPanel />

      {/* TODO: Render banners and spot banners here... */}

      <AccountList />
    </MainScreenLayout>
  );
};

export default PortfolioScreen;
