import { config } from "@hey-api/openapi-ts";
import { pluginZod } from "@hey-api/plugin-zod";

export default config({
  input: "http://localhost:8000/openapi.json",
  output: "src/generated",
  plugins: [pluginZod()],
});
