import ToolButton from "./ToolButton";
import { IoMdTrain, IoMdListBox } from "react-icons/io";
import ToolAnimation from "./ToolAnimation";

export function HomePage() {
    return (
        <main className="flex justify-center w-svw">
            <div className="container flex-col flex gap-3 p-3">
                <section className="flex flex-col items-center gap-3 cursor-default pt-10">
                    <h1 className="relative inline-block text-6xl font-semibold text-neutral-100 tracking-tighter overflow-visible">
                        <ToolAnimation />
                        <span className="relative z-10">go-tools</span>
                    </h1>

                    <p className="text-lg max-w-md text-center text-neutral-400 ">
                        A collection of real-time tools for GO Transit
                        commuters.
                    </p>
                </section>

                <section className="flex justify-center gap-4">
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
