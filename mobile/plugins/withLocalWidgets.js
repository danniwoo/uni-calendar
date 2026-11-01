const { withEntitlementsPlist } = require("expo/config-plugins");

// SDK 55 expo-widgets adds aps-environment even when push is disabled.
// This sample publishes timelines locally and never registers for remote push.
// Keep the shared App Group: the app and widget still require it.
// Register before expo-widgets: entitlement mods run in reverse registration order.
module.exports = function withLocalWidgets(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};
