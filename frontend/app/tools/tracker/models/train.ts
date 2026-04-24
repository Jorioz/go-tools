import type { LineCode } from "../utils/constants";

export interface RawTrainModel {
    trip_number: string;
    line_code: LineCode;
    direction: number;
    first_stop_code: string;
    last_stop_code: string;
    start_time: string;
    end_time: string;
    prev_stop_code: string;
    next_stop_code: string;
    latitude: number;
    longitude: number;
    progress: number;
    in_motion: boolean;
    modified_date: string;
    stopped_at_stop_code: string;
}

export interface TrainModel {
    trip_number: string;
    line_code: LineCode;
    direction: number;
    first_stop_code: string;
    last_stop_code: string;
    start_time: Date;
    end_time: Date;
    prev_stop_code: string;
    next_stop_code: string;
    latitude: number;
    longitude: number;
    progress: number;
    in_motion: boolean;
    modified_date: Date;
    stopped_at_stop_code: string;
}

export function toTrainModel(rawTrain: RawTrainModel): TrainModel {
    return {
        ...rawTrain,
        start_time: new Date(rawTrain.start_time),
        end_time: new Date(rawTrain.end_time),
        modified_date: new Date(rawTrain.modified_date),
    };
}

export function toTrainsByLine(
    rawLines: Partial<Record<LineCode, RawTrainModel[]>>,
): Partial<Record<LineCode, TrainModel[]>> {
    return Object.fromEntries(
        Object.entries(rawLines).map(([lineCode, trains]) => [
            lineCode,
            (trains ?? []).map(toTrainModel),
        ]),
    ) as Partial<Record<LineCode, TrainModel[]>>;
}
