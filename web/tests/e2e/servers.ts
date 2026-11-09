// Ports for the API and web app that the end-to-end tests start (see
// playwright.config.ts). Spare ports, so the dev servers can keep running.
export const API_PORT = 3110;
export const WEB_PORT = 3111;
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

// The seeded sandbox settings (prisma/settings.ts).
export const CLIENT_ID = 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY';
