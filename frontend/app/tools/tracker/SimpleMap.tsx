import React from "react";
import Line from "./lines/Line";
import UnionStation from "./UnionStation";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { LINES } from "./constants";

export default function SimpleMap() {
    return (
        <div className="w-full h-svh">
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
                        {LINES.map((line) => (
                            <div
                                key={line.id}
                                className="absolute inset-0 pointer-events-none"
                            >
                                <Line
                                    stations={line.stations}
                                    points={line.points}
                                    color={line.color}
                                    strokeClass={line.strokeClass}
                                    order={line.order}
                                />
                            </div>
                        ))}
                        <div className="absolute inset-0 pointer-events-none">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 13205 9500"
                                className="w-full h-full"
                            >
                                <UnionStation />
                            </svg>
                        </div>
                    </div>
                </TransformComponent>
            </TransformWrapper>
        </div>
    );
}
