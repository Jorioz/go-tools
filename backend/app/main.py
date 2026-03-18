from services.line_manager import LineManager
from models.line import Line
from constants import LINE_CODES

def main():
    manager = LineManager()
    lw = Line(LINE_CODES.LAKESHORE_EAST, manager)
    lw.plot(show_raw=False)
    

if __name__ == "__main__":
    main()