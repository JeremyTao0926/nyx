import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jeremytao.nyx",
  appName: "NYX",
  webDir: "dist",
  backgroundColor: "#090907",
  ios: { contentInset: "never", preferredContentMode: "mobile" },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#090907", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#090907" },
  },
};

export default config;
