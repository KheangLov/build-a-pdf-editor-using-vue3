import { createApp } from 'vue';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import App from './App.vue';
import './styles.css';

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'pdfStudio',
    themes: {
      pdfStudio: {
        dark: false,
        colors: {
          background: '#f6f8fb',
          surface: '#ffffff',
          primary: '#1769aa',
          secondary: '#4b5563',
          accent: '#0f766e',
          error: '#b42318',
          warning: '#b54708',
          info: '#175cd3',
          success: '#067647'
        }
      }
    }
  },
  defaults: {
    VBtn: {
      rounded: 'lg'
    },
    VTextField: {
      variant: 'outlined',
      density: 'compact'
    },
    VTextarea: {
      variant: 'outlined',
      density: 'compact'
    },
    VSelect: {
      variant: 'outlined',
      density: 'compact'
    }
  }
});

createApp(App).use(vuetify).mount('#app');
