#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(SFSymbolViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(name, NSString)
RCT_EXPORT_VIEW_PROPERTY(pointSize, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(weight, NSString)
RCT_EXPORT_VIEW_PROPERTY(scale, NSString)
RCT_EXPORT_VIEW_PROPERTY(colorHex, NSString)

@end
