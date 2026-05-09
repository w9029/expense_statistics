#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(DateFieldViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(value, NSString)
RCT_EXPORT_VIEW_PROPERTY(locale, NSString)
RCT_EXPORT_VIEW_PROPERTY(placeholder, NSString)
RCT_EXPORT_VIEW_PROPERTY(mode, NSString)
RCT_EXPORT_VIEW_PROPERTY(onDateChange, RCTBubblingEventBlock)

@end
