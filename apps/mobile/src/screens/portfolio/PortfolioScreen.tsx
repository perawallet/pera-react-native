import { Text, View } from 'react-native';
import { styles } from './styles';
import { SafeAreaView } from 'react-native-safe-area-context';

const PortfolioScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text>This will be the portfolio screen</Text>
      </View>
    </SafeAreaView>
  );
};

export default PortfolioScreen;
