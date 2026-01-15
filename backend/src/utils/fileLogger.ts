import * as fs from "fs";

export function fileLogger(data: string, filename: string) {
    fs.writeFile(filename, data, function (err) {
        if (err) {
            console.log(err);
        }
    });
}
