import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquasense.app',
  appName: 'AquaSense AI',
  webDir: 'dist',
  server: {
    // cleartext SÓ para rede local/debug (IP LAN). Em release/Play remover.
    cleartext: true,
    androidScheme: 'https',
    hostname: 'aquasense.local',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
