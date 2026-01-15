import * as fs from "fs";
import * as path from "path";

export function fileLogger(data: string, filename: string) {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFile(filename, data, function (err) {
        if (err) {
            console.log(err);
        }
    });
}
