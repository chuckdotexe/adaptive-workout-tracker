import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:4173'},webServer:{command:'node scripts/serve.mjs',port:4173,reuseExistingServer:true}});
