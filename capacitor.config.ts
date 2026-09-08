import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jeremytao.nyx",
  appName: "NYX",
  webDir: "dist",
  backgroundColor: "#F7F7FC",
  ios: { contentInset: "never", preferredContentMode: "mobile" },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#F7F7FC", showSpinner: false },
    StatusBar: { style: "DARK", backgroundColor: "#F7F7FC" },
  },
};

export default config;
