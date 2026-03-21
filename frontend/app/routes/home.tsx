import type { Route } from "./+types/home";
import { HomePage } from "../home/HomePage";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "go-tools" },
        {
            name: "description",
            content:
                "A collection of real-time tools for GO Transit commuters.",
        },
    ];
}

export default function Home() {
    return <HomePage />;
}
