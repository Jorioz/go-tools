const LIGHTEN_FATOR = 0.25;
const DARKEN_FACTOR = 0.5;

export const darken = (inputColor: string, factor = DARKEN_FACTOR): string => {
    const channels = inputColor.match(/[a-f\d]{2}/gi);
    if (!channels || channels.length < 3) {
        return inputColor;
    }

    return (
        "#" +
        channels
            .slice(0, 3)
            .map((channel) =>
                Math.floor(parseInt(channel, 16) * (1 - factor))
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
};

export const lighten = (inputColor: string, factor = LIGHTEN_FATOR): string => {
    const channels = inputColor.match(/[a-f\d]{2}/gi);
    if (!channels || channels.length < 3) {
        return inputColor;
    }

    return (
        "#" +
        channels
            .slice(0, 3)
            .map((channel) => {
                const value = parseInt(channel, 16);
                const lightened = Math.round(value + (255 - value) * factor);
                return lightened.toString(16).padStart(2, "0");
            })
            .join("")
    );
};
