import express from "express";

import { testVehicleFetch } from "./jobs/testVehicleFetch.js";
import { testMappers } from "./jobs/testMappers.js";
import { testLoadAllRoutes } from "./jobs/testLoadRoutes.js";
import { fileLogger } from "./utils/fileLogger.js";
import { splitRawShapes } from "./jobs/splitRawShapes.js";
import path from "path";
import { testLoadShapesForRoute } from "./jobs/testLoadShapeForRoute.js";
import { DirectionType } from "./models/Trip.js";
import { runGtfsDataConfig } from "./config/gtfsDataConfig.js";
import { buildRoutePackage } from "./jobs/buildRoutePackage.js";

if (!process.env.GO_API_KEY) {
    throw new Error("Missing GO_API_KEY");
}

const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`listening on ${port}`);
});

//testVehicleFetch();
//testMappers();
//testLoadAllRoutes();
//splitRawShapes();

//testLoadShapesForRoute("WH", DirectionType.TO_UNION);

runGtfsDataConfig();
console.log("Beginning Route Build...");
const pack = buildRoutePackage("LW");
pack.then((result) => {
    console.log(result);
    console.log("Route build finished.");
}).catch((err) => {
    console.error("Error building route package:", err);
});
