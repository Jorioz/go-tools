import { useMemo, useRef, useEffect } from "react";
import Line from "./Line";
import UnionStation from "./UnionStation";
import {
    TransformWrapper,
    TransformComponent,
    useControls,
} from "react-zoom-pan-pinch";
import { LINES, type LineCode } from "./utils/constants";
import type { Train, TrainsByLine } from "~/models/train";

export default function MapSimple({
    trainsByLine,
}: {
    trainsByLine: TrainsByLine;
}) {
    const unionStoppedTrains = useMemo(
        () =>
            Object.values(trainsByLine)
                .flatMap((lineTrains) => lineTrains ?? [])
                .filter(
                    (train) =>
                        !train.inMotion &&
                        train.stoppedAtStopCode.trim().toUpperCase() === "UN",
                ),
        [trainsByLine],
    );

    const transformRef = useRef<any>(null);

    useEffect(() => {
        const updateVh = () => {
            document.documentElement.style.setProperty(
                "--vh",
                `${window.innerHeight * 0.01}px`,
            );
        };

        const handleViewportChange = () => {
            updateVh();
            setTimeout(() => {
                const api: any = transformRef.current;
                if (!api) return;
                const instance = api.instance ?? api;
                if (typeof instance.centerView === "function") {
                    instance.centerView();
                } else if (typeof instance.resetTransform === "function") {
                    instance.resetTransform();
                } else if (
                    typeof api.setTransform === "function" &&
                    api.state
                ) {
                    api.setTransform(0, 0, api.state.scale);
                }
            }, 80);
        };

        handleViewportChange();
        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("orientationchange", handleViewportChange);
        return () => {
            window.removeEventListener("resize", handleViewportChange);
            window.removeEventListener(
                "orientationchange",
                handleViewportChange,
            );
        };
    }, []);

    return (
        <div className="w-full flex-1 bg-neutral-300 flex justify-center items-center px-10">
            <TransformWrapper
                ref={transformRef}
                initialScale={2}
                minScale={1.5}
                maxScale={10}
                centerOnInit
                doubleClick={{ disabled: true }}
                wheel={{ smoothStep: 0.005 }}
                panning={{ disabled: false }}
                limitToBounds={true}
            >
                <TransformComponent
                    wrapperStyle={{
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                    }}
                    contentStyle={{ width: "100%", overflow: "visible" }}
                >
                    <div
                        className="w-full"
                        style={{
                            height: "calc(var(--vh, 1vh) * 70)",
                            width: "100svw",
                            margin: "0 auto",
                            position: "relative",
                        }}
                    >
                        {/* Map #1 draws out the Lines, no Trains */}
                        {LINES.map((line) => (
                            <div
                                key={line.id}
                                className="absolute inset-0 pointer-events-none"
                            >
                                <Line
                                    lineCode={line.id}
                                    stations={line.stations}
                                    points={line.points}
                                    color={line.color}
                                    strokeClass={line.strokeClass}
                                    order={line.order}
                                    trains={trainsByLine[line.id] ?? []}
                                    extension={line.extension}
                                    showTrains={false}
                                    showBase={true}
                                />
                            </div>
                        ))}
                        <div className="absolute inset-0 pointer-events-none">
                            <div
                                style={{ aspectRatio: "13205 / 9500" }}
                                className="w-full h-full"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 13205 9500"
                                    width="100%"
                                    height="100%"
                                >
                                    <UnionStation
                                        trainsAtStop={unionStoppedTrains}
                                    />
                                </svg>
                            </div>
                        </div>
                        {/* Map #2 draws out the Trains, no Line */}
                        {LINES.map((line) => (
                            <div
                                key={`${line.id}-trains`}
                                className="absolute inset-0 pointer-events-none"
                            >
                                <Line
                                    lineCode={line.id}
                                    stations={line.stations}
                                    points={line.points}
                                    color={line.color}
                                    strokeClass={line.strokeClass}
                                    order={line.order}
                                    trains={trainsByLine[line.id] ?? []}
                                    extension={line.extension}
                                    showTrains={true}
                                    showBase={false}
                                />
                            </div>
                        ))}
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
}
