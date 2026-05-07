import React, { useState } from "react";
import { IoIosArrowUp } from "react-icons/io";

const lines = {
    BR: ["Barrie", "#155BA0"],
    KI: ["Kitchener", "#138336"],
    LE: ["Lakeshore East", "#EE2722"],
    LW: ["Lakeshore West", "#8B0A31"],
    MI: ["Milton", "#DD521F"],
    RH: ["Richmond Hill", "#27ADEA"],
    ST: ["Stouffville", "#774111"],
};

export default function Legend() {
    const [isOpen, setIsOpen] = useState(false);
    const renderLineItem = (key: string, name: string, color: string) => (
        <div key={key} className="flex items-center gap-3 ">
            <div
                className="h-8 w-8 flex items-center justify-center text-xs text-neutral-100 font-bold"
                style={{ backgroundColor: color }}
            >
                {key}
            </div>
            <span className="text-sm text-neutral-100">{name}</span>
        </div>
    );

    return (
        <div
            className={`bg-neutral-800 p-3 h-full flex flex-col transition-[gap] duration-300 ease-in-out ${isOpen ? "gap-3" : "gap-0"} rounded-sm border border-neutral-700`}
        >
            <button
                type="button"
                className="flex items-center justify-between text-neutral-100 font-semibold"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span>Legend</span>
                <span className="text-xs text-neutral-400">
                    <IoIosArrowUp
                        size={24}
                        className={`transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : ""}`}
                    />
                </span>
            </button>
            <div
                className={`grid md:grid-cols-3 grid-cols-1 gap-3 transition-all duration-300 ease-in-out ${
                    isOpen
                        ? "opacity-100 max-h-96"
                        : "opacity-0 max-h-0 overflow-hidden"
                }`}
            >
                {Object.entries(lines).map(([key, [name, color]]) =>
                    renderLineItem(key, name, color),
                )}
            </div>
        </div>
    );
}
