#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ClipboardModule, NSObject)

RCT_EXTERN_METHOD(copyText:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
