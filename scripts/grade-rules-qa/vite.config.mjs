import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
const repo=fileURLToPath(new URL("../../",import.meta.url));
export default defineConfig({root:fileURLToPath(new URL("./",import.meta.url)),plugins:[react()],resolve:{alias:{"@":repo}},server:{host:"127.0.0.1",fs:{allow:[repo]}}});
