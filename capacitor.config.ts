import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
   appId: 'com.aura.app',
  appName: 'aura-messenger',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;