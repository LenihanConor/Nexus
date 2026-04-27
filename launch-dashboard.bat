@echo off
cd /d "%~dp0"
node -e "import('./packages/dashboard/dist/server/server.js').then(m=>m.startServer({port:3000,open:true}))"
pause
