import { Outlet } from "react-router";
import { MapSelectionProvider } from "~/context/mapSelectionContext";
import { TrainProvider } from "~/context/trainContext";
import ToolsNavbar from "../../components/ToolsNavbar";

export default function ToolsLayout() {
    return (
        <TrainProvider>
            <MapSelectionProvider>
                <div className="min-h-svh overflow-y-hidden flex flex-col md:flex-row">
                    <ToolsNavbar />
                    <main className="flex flex-1">
                        <Outlet />
                    </main>
                </div>
            </MapSelectionProvider>
        </TrainProvider>
    );
}
