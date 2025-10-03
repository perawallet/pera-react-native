import PeraView from '../../components/common/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Text, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

import CameraIcon from '../../../assets/icons/camera.svg';
import BellIcon from '../../../assets/icons/bell.svg';
import InfoIcon from '../../../assets/icons/info.svg';

import CurrencyDisplay from '../../components/common/currency-display/CurrencyDisplay';
import ButtonPanel from '../../components/portfolio/button-panel/ButtonPanel';
import AccountList from '../../components/portfolio/account-list/AccountList';
import Decimal from 'decimal.js';

const PortfolioScreen = () => {
  const { theme } = useTheme();
  const styles = useStyles();

  //TODO fetch this from server etc.
  const portfolioValue = Decimal(0);

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
          currency="ALGO"
          precision={2}
          h1Style={styles.primaryCurrency}
        />
        <CurrencyDisplay
          h4
          h4Style={styles.valueTitle}
          value={portfolioValue}
          currency="USD"
          prefix="≈ "
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
