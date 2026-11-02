import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
const repo=fileURLToPath(new URL("../../",import.meta.url));
export default defineConfig({
  resolve:{alias:{"@":repo},dedupe:["react","react-dom"]},
  css:{postcss:repo},
  build:{rolldownOptions:{input:{account:"index.html",board:"board/index.html"}}},
  server:{fs:{allow:[repo]}},
});
