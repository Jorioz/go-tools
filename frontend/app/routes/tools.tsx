import type { Route } from "./+types/tools";
import Tracker from "~/tools/tracker/Tracker";

export function meta({}: Route.MetaArgs) {
    return [{ title: "go-tools ~ tracker" }];
}

export default function Tools({ params }: Route.ComponentProps) {
    const { tool } = params;

    switch (tool) {
        case "tracker":
            return <Tracker />;
        default:
            return <div>Not found.</div>;
    }
}
