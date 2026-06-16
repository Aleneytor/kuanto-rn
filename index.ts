import { registerRootComponent } from 'expo';

import App from './App';
import { configureHandlerAndChannels } from './src/services/notificationService';

// Configura el handler de notificaciones (cómo se muestran en primer plano) y
// los canales Android. Debe correr lo antes posible, antes de montar la app.
configureHandlerAndChannels();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
