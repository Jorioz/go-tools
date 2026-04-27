import React from "react";
import { CiCircleAlert } from "react-icons/ci";
import {
    IoIosInformationCircle,
    IoMdCloseCircle,
    IoIosWarning,
    IoIosCheckmarkCircle,
} from "react-icons/io";

type BannerType = "error" | "warning" | "info" | "success" | "generic";
const bannerStyles: Record<
    BannerType,
    { bg: string; text: string; icon?: React.JSX.Element }
> = {
    error: {
        bg: "bg-red-500",
        text: "text-white",
        icon: <IoMdCloseCircle className="w-6 h-6 mr-2 text-white" />,
    },
    warning: {
        bg: "bg-yellow-500",
        text: "text-white",
        icon: <IoIosWarning className="w-6 h-6 mr-2 text-white" />,
    },
    info: {
        bg: "bg-blue-400",
        text: "text-white",
        icon: <IoIosInformationCircle className="w-6 h-6 mr-2 text-white" />,
    },
    success: {
        bg: "bg-green-600",
        text: "text-white",
        icon: <IoIosCheckmarkCircle className="w-6 h-6 mr-2 text-white" />,
    },
    generic: {
        bg: "bg-stone-400",
        text: "text-white",
    },
};
interface BannerProps {
    message: string;
    type?: BannerType;
}

export default function Banner({ message, type = "generic" }: BannerProps) {
    const style = bannerStyles[type];
    return (
        <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 min-w-75 max-w-lg px-4 py-3 rounded-lg shadow-md ${style.bg} ${style.text} flex items-center justify-center`}
            role="alert"
        >
            {style.icon}
            <span className="text-base text-shadow-md">{message}</span>
        </div>
    );
}
