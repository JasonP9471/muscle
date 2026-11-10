import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID || 'com.trainos.mobile',
  appName: process.env.CAPACITOR_APP_NAME || 'TrainOS',
  webDir: 'dist',
  backgroundColor: '#080a0b',
  ios: {
    backgroundColor: '#080a0b',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#080a0b',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#080a0b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080a0b',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_trainos',
      iconColor: '#baff29',
    },
  },
}

export default config
