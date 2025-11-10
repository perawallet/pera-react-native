import React, { PropsWithChildren } from 'react';
import PeraBottomSheet from '../components/common/bottom-sheet/PeraBottomSheet';
import { useAppStore } from '@perawallet/core';
import SigningView from '../components/signing-view/SigningView';
import { useWindowDimensions } from 'react-native';

type SigningProviderProps = {} & PropsWithChildren;

export function SigningProvider({ children }: SigningProviderProps) {
  const { pendingSignRequests } = useAppStore();
  const nextRequest = pendingSignRequests.at(0);
  const { height } = useWindowDimensions();

  return (
    <>
      {children}
      <PeraBottomSheet
        innerContainerStyle={{ height: height - 100 }}
        isVisible={!!nextRequest}
      >
        {!!nextRequest && <SigningView request={nextRequest} />}
      </PeraBottomSheet>
    </>
  );
}
