import React from "react";
import { IoMdHome, IoIosMenu, IoMdBuild } from "react-icons/io";

import {
    Menu,
    MenuButton,
    MenuItem,
    MenuItems,
    Popover,
    Transition,
} from "@headlessui/react";
import { Link } from "react-router";

export default function ToolsNavbar() {
    const tools = [{ label: "Tracker", to: "/tools/tracker" }];

    return (
        <>
            <header className="w-full h-12 fixed top-0 left-0 flex items-center px-4 bg-neutral-800 text-white border-b border-neutral-700 z-50">
                <div className="w-full h-full flex items-center justify-between relative">
                    <div className="flex items-center gap-3 md:hidden">
                        <p className="font-semibold tracking-wider">go-tools</p>
                    </div>

                    <nav className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
                        <span className="font-semibold tracking-wider">
                            go-tools
                        </span>
                        <span
                            className="h-5 w-px bg-neutral-600"
                            aria-hidden="true"
                        />
                        <Link
                            to="/"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-neutral-700"
                        >
                            <IoMdHome size={18} />
                            <span>Home</span>
                        </Link>
                        <Menu>
                            <MenuButton className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-neutral-700">
                                <IoMdBuild size={18} />
                                <span>Tools</span>
                            </MenuButton>
                            <MenuItems
                                anchor="bottom end"
                                className="mt-2 w-44 rounded-md border border-neutral-700 bg-neutral-800 p-1 shadow-lg focus:outline-none"
                            >
                                {tools.map((tool) => (
                                    <MenuItem key={tool.to}>
                                        {({ active }) => (
                                            <Link
                                                to={tool.to}
                                                className={`block rounded-md px-3 py-2 text-sm ${
                                                    active
                                                        ? "bg-neutral-700 text-white"
                                                        : "text-neutral-100"
                                                }`}
                                            >
                                                {tool.label}
                                            </Link>
                                        )}
                                    </MenuItem>
                                ))}
                            </MenuItems>
                        </Menu>
                    </nav>

                    <Popover className="relative md:hidden">
                        {({ open }) => (
                            <>
                                <Popover.Button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-700">
                                    <IoIosMenu size={22} />
                                </Popover.Button>
                                <Transition
                                    show={open}
                                    enter="transition-opacity duration-200"
                                    enterFrom="opacity-0"
                                    enterTo="opacity-100"
                                    leave="transition-opacity duration-150"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <div
                                        className="fixed left-0 right-0 top-12 bottom-0 bg-black/40 z-30"
                                        aria-hidden="true"
                                    />
                                </Transition>
                                <Transition
                                    show={open}
                                    enter="transition duration-200 ease-out"
                                    enterFrom="-translate-y-2 opacity-0"
                                    enterTo="translate-y-0 opacity-100"
                                    leave="transition duration-150 ease-in"
                                    leaveFrom="translate-y-0 opacity-100"
                                    leaveTo="-translate-y-2 opacity-0"
                                >
                                    <Popover.Panel className="fixed left-0 right-0 top-12 w-full border-b border-neutral-700 bg-neutral-800 p-2 shadow-lg z-40">
                                        <Link
                                            to="/"
                                            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-neutral-700"
                                        >
                                            <IoMdHome size={16} />
                                            <span>Home</span>
                                        </Link>
                                        <div className="mt-1 border-t border-neutral-700 pt-1">
                                            {tools.map((tool) => (
                                                <Link
                                                    key={tool.to}
                                                    to={tool.to}
                                                    className="flex items-center justify-center rounded-md px-3 py-2 text-sm hover:bg-neutral-700"
                                                >
                                                    {tool.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </Popover.Panel>
                                </Transition>
                            </>
                        )}
                    </Popover>
                </div>
            </header>
        </>
    );
}
