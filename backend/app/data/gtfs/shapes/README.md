## data/gtfs/shapes/

Data here has been gitignored. This folder holds the shapefiles for each route, which can be found in raw/GO-GTFS/shapes.txt.
A helper function in /utils is used to split the raw files into individual ones.

On startup, the backend checks if this directory is empty and, if so, runs the helper to populate it.
To force regeneration, delete the contents and restart the backend.
