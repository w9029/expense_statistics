#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(ColorWellViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(colorHex, NSString)
RCT_EXPORT_VIEW_PROPERTY(onColorChange, RCTBubblingEventBlock)

@end
