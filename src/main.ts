import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './design/tokens.css'
import './style.css'
import './design/shell.css'

createApp(App).use(router).mount('#app')
