import React from "react";
import { Button } from "@headlessui/react";
import { Link } from "react-router";

interface Props {
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    href?: string;
}

export default function ToolButton({
    label,
    description,
    icon,
    color,
    href,
}: Props) {
    const buttonClass =
        "bg-neutral-900 col-span-1 w-full border border-neutral-800 rounded-sm p-3 flex flex-col items-center gap-3 hover:bg-neutral-800 hover:border-neutral-700 duration-100 cursor-pointer max-w-56";

    if (href) {
        return (
            <Link to={href} className={buttonClass}>
                <div className="flex items-center">
                    <div className={`text-3xl mb-2 ${color}`}>{icon}</div>
                </div>
                <div className="text-center">
                    <h2 className="text-neutral-100 font-semibold text-xl">
                        {label}
                    </h2>
                    <p className="text-neutral-500">{description}</p>
                </div>
            </Link>
        );
    }

    return (
        <Button className={buttonClass}>
            <div className="flex items-center">
                <div className={`text-3xl mb-2 ${color}`}>{icon}</div>
            </div>
            <div className="text-center">
                <h2 className="text-neutral-100 font-semibold text-xl">
                    {label}
                </h2>
                <p className="text-neutral-500">{description}</p>
            </div>
        </Button>
    );
}
