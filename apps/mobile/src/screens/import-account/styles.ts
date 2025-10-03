import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    mainContainer: {
      flex: 1,
    },
    helperText: {
      color: theme.colors.textGray,
      paddingBottom: theme.spacing.xl * 2,
    },
    walletNameContainer: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderRadius: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    nameText: {
      color: theme.colors.textGray,
      alignSelf: 'center',
    },
    finishButton: {
      marginHorizontal: theme.spacing.xl,
    },
    spacer: {
      flexGrow: 1,
    },
    wordContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    column: {
      width: '47%',
    },
    scrollView: {
      paddingBottom: theme.spacing.lg,
    },
    inputContainerRow: {
      marginTop: theme.spacing.sm,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    label: {
      color: theme.colors.textGray,
    },
    focusedLabel: {
      color: theme.colors.textMain,
    },
    inputOuterContainer: {
      flexShrink: 1,
    },
    inputContainer: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.layerGray,
      flexShrink: 1,
    },
    focusedInputContainer: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.textMain,
      flexShrink: 1,
    },
    input: {
      flexShrink: 1,
      backgroundColor: 'transparent',
    },
    overlayBackdrop: {
      backgroundColor: 'rgba(52, 52, 52, 0.8)',
    },
    overlay: {
      padding: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.layerGray,
      borderRadius: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
  };
});
