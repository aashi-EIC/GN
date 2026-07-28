import axios from "axios";

export const mcpClient = axios.create({
  timeout: 30000,
});
