import { Contact } from '@perawallet/core';
import { Image, useTheme } from '@rneui/themed';
import { SvgProps } from 'react-native-svg';
import PersonIcon from '../../../../assets/icons/person.svg';
import { useStyles } from './styles';
import PeraView from '../view/PeraView';

type ContactAvatarProps = {
  size: 'small' | 'large';
  contact?: Contact;
} & SvgProps;

const ContactAvatar = ({ size, contact, ...rest }: ContactAvatarProps) => {
  const { theme } = useTheme();
  const dimensions = size === 'small' ? theme.spacing.xl : theme.spacing.xl * 3;
  const iconSize = size === 'small' ? theme.spacing.lg : theme.spacing.xl * 2;
  const styles = useStyles(dimensions);

  return (
    <PeraView style={styles.container}>
      {!!contact?.image && (
        <Image
          source={{ uri: contact.image }}
          style={{ width: iconSize, height: iconSize }}
        />
      )}
      {!contact?.image && (
        <PersonIcon
          {...rest}
          width={iconSize}
          height={iconSize}
          color={theme.colors.textGray}
        />
      )}
    </PeraView>
  );
};

export default ContactAvatar;
