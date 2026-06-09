#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PeraAgeGate, NSObject)

RCT_EXTERN_METHOD(getDeviceCapability:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAgeRange:(nonnull NSNumber *)minimumAge
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
