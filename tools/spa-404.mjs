// GitHub Pages has no SPA fallback: serve index.html as 404.html so refreshing /messages etc. still loads the app.
import { copyFileSync, existsSync } from 'node:fs'
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/404.html')
