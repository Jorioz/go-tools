interface Station {
    name: string;
    pointIndex: number;
    label: string;
}

export const LINE_CODES = ["MI", "LW", "LE", "GT", "BR", "RH", "ST"] as const;
export type LineCode = (typeof LINE_CODES)[number];

export const MILTON_STOPS = {
    ML: "Milton",
    LS: "Lisgar",
    ME: "Meadowvale",
    SR: "Streetsville",
    ER: "Erindale",
    CO: "Cooksville",
    DI: "Dixie",
    KP: "Kipling",
    UN: "Union",
} as const;

export const LAKESHORE_WEST_STOPS = {
    NI: "Niagara Falls",
    SCTH: "St. Catharines",
    CF: "Confederation",
    WR: "West Harbour",
    HA: "Hamilton",
    AL: "Aldershot",
    BU: "Burlington",
    AP: "Appleby",
    BO: "Bronte",
    OA: "Oakville",
    CL: "Clarkson",
    PO: "Port Credit",
    LO: "Long Branch",
    MI: "Mimico",
    EX: "Exhibition",
    UN: "Union",
} as const;

export const LAKESHORE_EAST_STOPS = {
    OS: "Oshawa",
    WH: "Whitby",
    AJ: "Ajax",
    PIN: "Pickering",
    RO: "Rouge Hill",
    GU: "Guildwood",
    EG: "Eglinton",
    SC: "Scarborough",
    DA: "Danforth",
    UN: "Union",
} as const;

export const KITCHENER_STOPS = {
    KI: "Kitchener",
    GL: "Guelph Central",
    AC: "Acton",
    GE: "Georgetown",
    MO: "Mount Pleasant",
    BR: "Brampton",
    BE: "Bramalea",
    MA: "Malton",
    ET: "Etobicoke North",
    WE: "Weston",
    MD: "Mount Dennis",
    BL: "Bloor",
    UN: "Union",
} as const;

export const BARRIE_STOPS = {
    AD: "Allandale Waterfront",
    BA: "Barrie South",
    BD: "Bradford",
    EA: "East Gwillimbury",
    NE: "Newmarket",
    AU: "Aurora",
    KC: "King City",
    MP: "Maple",
    RU: "Rutherford",
    DW: "Downsview Park",
    UN: "Union",
} as const;

export const RICHMOND_HILL_STOPS = {
    BM: "Bloomington",
    GO: "Gormley",
    RI: "Richmond Hill",
    LA: "Langstaff",
    OL: "Old Cummer",
    OR: "Oriole",
    UN: "Union",
} as const;

export const STOUFFVILLE_STOPS = {
    LI: "Old Elm",
    ST: "Stouffville",
    MJ: "Mount Joy",
    MR: "Markham",
    CE: "Centennial",
    UI: "Unionville",
    MK: "Milliken",
    AG: "Agincourt",
    KE: "Kennedy",
    UN: "Union",
} as const;

export const STOPS_BY_LINE: Record<LineCode, Record<string, string>> = {
    MI: MILTON_STOPS,
    LW: LAKESHORE_WEST_STOPS,
    LE: LAKESHORE_EAST_STOPS,
    GT: KITCHENER_STOPS,
    BR: BARRIE_STOPS,
    RH: RICHMOND_HILL_STOPS,
    ST: STOUFFVILLE_STOPS,
};

export const getStopName = (lineCode: string, stopCode: string): string => {
    const normalizedLine = lineCode.trim().toUpperCase() as LineCode;
    const normalizedStop = stopCode.trim().toUpperCase();
    const stops = STOPS_BY_LINE[normalizedLine];
    if (!stops) {
        return normalizedStop;
    }
    return stops[normalizedStop] ?? normalizedStop;
};

interface LineExtension {
    fromPointIndex: number;
    point: [number, number];
    station?: {
        name: string;
        label: "top" | "bottom" | "left" | "right";
    };
}

interface LineConfig {
    id: LineCode;
    name: string;
    color: string;
    strokeClass: string;
    order: number;
    points: number[][];
    stations: Station[];
    extension?: LineExtension;
}

export const LINE_SPACING = 110;
export const UNION_BASE_Y = 5850;

export const LINES: LineConfig[] = [
    {
        id: "LW",
        name: "Lakeshore West",
        color: "#8B0A31",
        strokeClass: "stroke-[#8B0A31] stroke-100",
        order: 5,
        points: [
            [7311, 5972],
            [6781.74, 5972],
            [6302.78, 6446],
            [6071.13, 6446],
            [5657.91, 6446],
            [5244.7, 6446],
            [4298.78, 6446],
            [3472.35, 6446],
            [2940.7, 6446],
            [2468, 6446],
            [2113.22, 6446],
            [1759.48, 6446],
            [1109.39, 6446],
            [986.52, 6446],
            [875, 6556.61],
            [875, 6919.22],
            [989.93, 7035.29],
            [1460, 7510],
            [1937.91, 7510],
            [5059.22, 7510],
            [5362.25, 7806.52],
            [5603.91, 8043],
            [7665.3, 8043],
        ],
        stations: [
            { name: "Exhibition", pointIndex: 3, label: "bottom" },
            { name: "Mimico", pointIndex: 4, label: "top" },
            { name: "Long Branch", pointIndex: 5, label: "bottom" },
            { name: "Port Credit", pointIndex: 6, label: "top" },
            { name: "Clarkson", pointIndex: 7, label: "bottom" },
            { name: "Oakville", pointIndex: 8, label: "top" },
            { name: "Bronte", pointIndex: 9, label: "bottom" },
            { name: "Appleby", pointIndex: 10, label: "top" },
            { name: "Burlington", pointIndex: 11, label: "bottom" },
            { name: "Aldershot", pointIndex: 12, label: "top" },
            { name: "West Harbour", pointIndex: 16, label: "left" },
            { name: "Confederation", pointIndex: 18, label: "bottom" },
            { name: "St. Catharines", pointIndex: 20, label: "left" },
            { name: "Niagara Falls", pointIndex: 22, label: "bottom" },
        ],
        extension: {
            fromPointIndex: 12,
            point: [500, 6446],
            station: { name: "Hamilton", label: "left" },
        },
    },
    {
        id: "MI",
        name: "Milton",
        color: "#DD521F",
        strokeClass: "stroke-[#DD521F] stroke-100",
        order: 4,
        points: [
            [7311, 5914],
            [5658.3, 5914],
            [4801.35, 5914],
            [4299.3, 5914],
            [3946, 5914],
            [3946, 5266.35],
            [3736.11, 5055.54],
            [3411.01, 4728.99],
            [3177.04, 4494],
            [2498.52, 4494],
            [1938.17, 4494],
            [1582.09, 4494],
        ],
        stations: [
            { name: "Kipling", pointIndex: 1, label: "top" },
            { name: "Dixie", pointIndex: 2, label: "bottom" },
            { name: "Cooksville", pointIndex: 3, label: "top" },
            { name: "Erindale", pointIndex: 6, label: "right" },
            { name: "Streetsville", pointIndex: 7, label: "left" },
            { name: "Meadowvale", pointIndex: 9, label: "top" },
            { name: "Lisgar", pointIndex: 10, label: "bottom" },
            { name: "Milton", pointIndex: 11, label: "top" },
        ],
    },
    {
        id: "GT",
        name: "Kitchener",
        color: "#138336",
        strokeClass: "stroke-[#138336] stroke-100",
        order: 2,
        points: [
            [7311, 5796],
            [6425.91, 5796],
            [6129.86, 5499.27],
            [5922.7, 5291.65],
            [5716.71, 5085.2],
            [5481, 4848.96],
            [5481, 4256.91],
            [5421.49, 4197.38],
            [5025.29, 3801.06],
            [4801.76, 3577.46],
            [3826.61, 2602],
            [3355.87, 2602],
            [2882.78, 2602],
            [2411.65, 2602],
            [1938.96, 2602],
            [1230.7, 2602],
            [875, 2602],
        ],
        stations: [
            { name: "Bloor", pointIndex: 2, label: "right" },
            { name: "Mount Dennis", pointIndex: 3, label: "left" },
            { name: "Weston", pointIndex: 4, label: "right" },
            { name: "Etobicoke North", pointIndex: 7, label: "left" },
            { name: "Malton", pointIndex: 8, label: "right" },
            { name: "Bramalea", pointIndex: 9, label: "left" },
            { name: "Brampton", pointIndex: 11, label: "top" },
            { name: "Mount Pleasant", pointIndex: 12, label: "bottom" },
            { name: "Georgetown", pointIndex: 13, label: "top" },
            { name: "Acton", pointIndex: 14, label: "bottom" },
            { name: "Guelph Central", pointIndex: 15, label: "bottom" },
            { name: "Kitchener", pointIndex: 16, label: "top" },
        ],
    },
    {
        id: "BR",
        name: "Barrie",
        color: "#155BA0",
        strokeClass: "stroke-[#155BA0] stroke-100",
        order: 0,
        points: [
            [7311, 5735],
            [6780, 5735],
            [6780, 4197.83],
            [6780, 3073.48],
            [6780, 2836.09],
            [6780, 2602],
            [6780, 2545.48],
            [7138.5, 2180.5],
            [7193, 2062.87],
            [7193, 2009.65],
            [7193, 1772.52],
            [7193, 1536.17],
            [7193, 1451.39],
            [6780, 1036.09],
            [6780, 944.78],
            [6780, 707.39],
            [6780, 468.7],
        ],
        stations: [
            { name: "Downsview Park", pointIndex: 2, label: "left" },
            { name: "Rutherford", pointIndex: 3, label: "left" },
            { name: "Maple", pointIndex: 4, label: "right" },
            { name: "King City", pointIndex: 5, label: "left" },
            { name: "Aurora", pointIndex: 9, label: "right" },
            { name: "Newmarket", pointIndex: 10, label: "left" },
            { name: "East Gwillimbury", pointIndex: 11, label: "right" },
            { name: "Bradford", pointIndex: 14, label: "left" },
            { name: "Barrie South", pointIndex: 15, label: "right" },
            { name: "Allandale Waterfront", pointIndex: 16, label: "left" },
        ],
    },
    {
        id: "RH",
        name: "Richmond Hill",
        color: "#27adea",
        strokeClass: "stroke-[#27adea] stroke-100",
        order: 0,
        points: [
            [7311, 5735],
            [7843, 5735],
            [7843, 4197.44],
            [7843, 3902],
            [7843, 3074],
            [7843, 2836.87],
            [7843, 2755.09],
            [8037.02, 2559.03],
            [8232.5, 2361.5],
        ],
        stations: [
            { name: "Oriole", pointIndex: 2, label: "right" },
            { name: "Old Cummer", pointIndex: 3, label: "right" },
            { name: "Langstaff", pointIndex: 4, label: "right" },
            { name: "Richmond Hill", pointIndex: 5, label: "right" },
            { name: "Gormley", pointIndex: 7, label: "right" },
            { name: "Bloomington", pointIndex: 8, label: "right" },
        ],
    },
    {
        id: "ST",
        name: "Stouffville",
        color: "#774111",
        strokeClass: "stroke-[#774111] stroke-100",
        order: 2,
        points: [
            [7311, 5796],
            [8197.48, 5796],
            [9142, 4849.74],
            [9142, 4730.78],
            [9142, 4197.83],
            [9142, 3901.74],
            [9142, 3393.83],
            [9361.19, 3174.67],
            [9538.86, 2997.04],
            [9716.01, 2819.92],
            [9893.68, 2642.29],
            [10072.5, 2463.5],
        ],
        stations: [
            { name: "Kennedy", pointIndex: 3, label: "left" },
            { name: "Agincourt", pointIndex: 4, label: "right" },
            { name: "Milliken", pointIndex: 5, label: "right" },
            { name: "Unionville", pointIndex: 6, label: "right" },
            { name: "Centennial", pointIndex: 7, label: "right" },
            { name: "Markham", pointIndex: 8, label: "right" },
            { name: "Mount Joy", pointIndex: 9, label: "right" },
            { name: "Stouffville", pointIndex: 10, label: "right" },
            { name: "Old Elm", pointIndex: 11, label: "right" },
        ],
    },
    {
        id: "LE",
        name: "Lakeshore East",
        color: "#EE2722",
        strokeClass: "stroke-[#EE2722] stroke-100",
        order: 5,
        points: [
            [7311, 5972],
            [8108.52, 5972],
            [8536.35, 5541.82],
            [8742, 5335.05],
            [8948.18, 5127.74],
            [9108.04, 4967],
            [9615.17, 4967],
            [10028, 4967],
            [10224.43, 4967],
            [10469.78, 4730],
            [10678.74, 4730],
            [10912.35, 4730],
            [11150.65, 4730],
            [11386.61, 4730],
        ],
        stations: [
            { name: "Danforth", pointIndex: 2, label: "right" },
            { name: "Scarborough", pointIndex: 3, label: "right" },
            { name: "Eglinton", pointIndex: 4, label: "right" },
            { name: "Guildwood", pointIndex: 6, label: "top" },
            { name: "Rouge Hill", pointIndex: 7, label: "bottom" },
            { name: "Pickering", pointIndex: 10, label: "top" },
            { name: "Ajax", pointIndex: 11, label: "bottom" },
            { name: "Whitby", pointIndex: 12, label: "top" },
            { name: "Oshawa", pointIndex: 13, label: "bottom" },
        ],
    },
];
