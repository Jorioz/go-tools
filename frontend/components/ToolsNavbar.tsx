import React from "react";
import { IoMdHome } from "react-icons/io";
import { Button } from "@headlessui/react";
import UpdateCircle from "~/tools/tracker/components/UpdateCircle";

export default function ToolsNavbar() {
    return (
        <header className="w-full h-12 flex items-center px-4 bg-neutral-500 text-white md:h-screen md:w-56 md:flex-col md:items-start shrink-0">
            <div className="w-full h-full flex md:justify-center md:items-start items-center">
                <p className="font-semibold">go-tools</p>
                <UpdateCircle />
            </div>
        </header>
    );
}
