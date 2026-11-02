const base = require("./app.json");

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    name: "Semester Preview · Reminders",
    slug: "semester-preview-reminders",
    scheme: "semester-preview-reminders",
    ios: {
      ...base.expo.ios,
      bundleIdentifier: "dev.semester.preview.reminders",
      buildNumber: "1",
    },
  },
};
