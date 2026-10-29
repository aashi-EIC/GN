import { bffClient } from "../../../shared/services/axios";
import { installModelCatalog } from "../utils/modelCatalog";

let loading: Promise<void> | undefined;

export function loadModelCatalog() {
  if (!loading) {
    loading = bffClient
      .get<unknown>("/semantic-models", { timeout: 10_000 })
      .then(({ data }) => installModelCatalog(data))
      .catch((error: unknown) => {
        loading = undefined;
        throw error;
      });
  }
  return loading;
}
