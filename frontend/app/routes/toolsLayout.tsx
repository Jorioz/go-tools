import { Outlet } from "react-router";
import { TrainProvider } from "~/context/trainContext";
import ToolsNavbar from "../../components/ToolsNavbar";

export default function ToolsLayout() {
    return (
        <TrainProvider>
            <div className="min-h-svh overflow-y-hidden flex flex-col md:flex-row">
                <ToolsNavbar />
                <main className="flex flex-1">
                    <Outlet />
                </main>
            </div>
        </TrainProvider>
    );
}
