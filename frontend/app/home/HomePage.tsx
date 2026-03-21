import ToolButton from "./ToolButton";
import { IoMdTrain, IoMdListBox } from "react-icons/io";

export function HomePage() {
    return (
        <main className="flex justify-center w-svw">
            <div className="container flex-col flex gap-3 p-3">
                <section className="flex flex-col items-center gap-3 cursor-default">
                    <h1 className="text-6xl font-semibold text-neutral-100 tracking-tighter">
                        go-tools
                    </h1>
                    <p className="text-lg max-w-md text-center text-neutral-400 ">
                        A collection of real-time tools for GO Transit
                        commuters.
                    </p>
                </section>
                <section className="grid grid-cols-2 w-full gap-4">
                    <ToolButton
                        label="Train Tracker"
                        description="See live train positions on a map."
                        icon={<IoMdTrain size={50} />}
                        color="text-lime-300"
                        href="/tools/tracker"
                    />
                    <ToolButton
                        label="Union Board"
                        description="View departures board displayed at Union Station."
                        icon={<IoMdListBox size={50} />}
                        color="text-teal-300"
                        href="/tools/board"
                    />
                </section>
            </div>
        </main>
    );
}
