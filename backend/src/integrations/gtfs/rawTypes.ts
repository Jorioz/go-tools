export type GtfsRouteRaw = {
    route_id: string;
    agency_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: string;
    route_color?: string;
    route_text_color?: string;
};

export type GtfsShapeRaw = {
    shape_id: string;
    shape_pt_lat: string;
    shape_pt_lon: string;
    shape_pt_sequence: string;
};

export type GtfsStopRaw = {
    stop_id: string;
    stop_name: string;
    stop_lat: string;
    stop_lon: string;
    zone_id: string;
    stop_url: string;
    location_type: string;
    parent_station: string;
    wheelchair_boarding: string;
    stop_code: string;
};
