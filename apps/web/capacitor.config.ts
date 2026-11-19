import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.lobojoel2003.outagekit',
  appName: 'Outagekit',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b1220',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_outagekit',
      iconColor: '#F5A524',
    },
  },
};

export default config;
