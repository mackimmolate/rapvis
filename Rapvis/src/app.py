
import sys
from controller import DemandController

def main():
    app = DemandController(None)
    app.start()
    sys.exit(0)

if __name__ == "__main__":
    main()
