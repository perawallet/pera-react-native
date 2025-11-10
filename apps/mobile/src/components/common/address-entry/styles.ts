import { makeStyles } from '@rneui/themed';
import { AddressEntryFieldProps } from './AddressEntryField';

export const useStyles = makeStyles((theme, props: AddressEntryFieldProps) => {
  return {
    container: {
      padding: 0,
      margin: 0
    },
    icon: {

    }, 
    closeIcon: {

    },
    closeIconButton: {
      marginTop: theme.spacing.xl,
      marginLeft: theme.spacing.lg,
      width: theme.spacing.xl * 2,
      height: theme.spacing.xl * 2,
      zIndex: 2
    },
  };
});
