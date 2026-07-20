import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Telegram serves the Mini App over HTTPS; locally you'll need an HTTPS tunnel
// (e.g. `vite --https` with a cert, or ngrok/cloudflared) to open it in Telegram.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
    },
});
