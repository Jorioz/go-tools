import express from "express";

import { testVehicleFetch } from "./jobs/testVehicleFetch.js";

if (!process.env.GO_API_KEY) {
    throw new Error("Missing GO_API_KEY");
}

const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`listening on ${port}`);
});

testVehicleFetch();
