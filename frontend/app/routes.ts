import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("tools", "routes/toolsLayout.tsx", [
        route(":tool", "routes/tools.tsx"),
    ]),
] satisfies RouteConfig;
