/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL?: string;
	readonly VITE_BACKEND_URL?: string;
	readonly VITE_SERVER_URL?: string;
	readonly VITE_APP_MODE?: string;
	readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
