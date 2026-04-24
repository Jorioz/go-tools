import React, { useMemo } from "react";
import Line from "./Line";
import UnionStation from "./UnionStation";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { LINES, type LineCode } from "./utils/constants";
import type { TrainModel } from "./models/train";

interface MapSimpleProps {
    trainsByLine: Partial<Record<LineCode, TrainModel[]>>;
}

export default function MapSimple({ trainsByLine }: MapSimpleProps) {
    const unionStoppedTrains = useMemo(
        () =>
            Object.values(trainsByLine)
                .flatMap((lineTrains) => lineTrains ?? [])
                .filter(
                    (train) =>
                        !train.in_motion &&
                        train.stopped_at_stop_code.trim().toUpperCase() ===
                            "UN",
                ),
        [trainsByLine],
    );

    return (
        <div className="w-full h-svh bg-neutral-300">
            <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={10}
                centerOnInit
                doubleClick={{ disabled: true }}
                wheel={{ smoothStep: 0.01 }}
                panning={{ disabled: false }}
                limitToBounds={false}
            >
                <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%", height: "100%" }}
                >
                    <div className="relative w-full h-full">
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
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 13205 9500"
                                className="w-full h-full"
                            >
                                <UnionStation
                                    trainsAtStop={unionStoppedTrains}
                                />
                            </svg>
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
