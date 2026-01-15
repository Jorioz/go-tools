import type { Trip } from "../../models/Trip.js";

export function mapRawTrip(trip: any): Trip {
    return {
        tripId: trip.trip_id,
        routeId: trip.route_id,
        directionId: trip.direction_id,
        startTime: trip.start_time,
        startDate: trip.start_date,
        scheduleRelationship: trip.schedule_relationship,
    };
}
