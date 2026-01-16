import { loadAllRoutes } from "../services/routeService.js";

export async function testLoadAllRoutes() {
    const routes = await loadAllRoutes();
    console.log(routes);
}
