# Efterfrågeanalys (Rapvis)

**Version:** 0.3.0
**Author:** MackImmolate

Efterfrågeanalys is a Python-based desktop application designed for analyzing demand data for articles. It allows users to visualize current demand versus historical data, filter by time periods (weeks, months, years), and identify trends.

## Features

*   **Visual Analysis:** Interactive graph showing demand over time.
*   **Comparison:** Compare current request data ("Förfrågan") against historical data ("Historik").
*   **Flexible Time Scales:** View data by Week, Month, or Year.
*   **Filtering:** Filter by specific articles, predefined groups (Audi, VW), or custom date ranges.
*   **Insights:** Automated summary of total demand.
*   **Grid Layout:** Clean, responsive table view with detailed breakdown.
*   **Click-to-Filter:** Click on any point in the graph to filter the table to that specific period.

## Installation

### For Users (Windows Installer)
1.  Download `Rapvis_Setup_v0.3.0.exe`.
2.  Run the installer.
3.  The application will be installed to your local AppData folder (`%LOCALAPPDATA%\Rapvis`).
4.  Launch "Rapvis" from your Desktop or Start Menu.

### For Developers

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/rapvis.git
    cd rapvis
    ```

2.  **Set up the environment:**
    Ensure you have Python 3.10+ installed.
    ```bash
    python -m venv .venv
    # Windows:
    .venv\Scripts\activate
    # Linux/Mac:
    source .venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r Rapvis/requirements.txt
    ```

4.  **Run the application:**
    ```bash
    python Rapvis/src/app.py
    ```

## Building the Executable

The project uses **PyInstaller** to create a standalone executable.

1.  Ensure you have the dev dependencies installed (including `pyinstaller`).
2.  Run the build command from the `Rapvis` directory:
    ```bash
    cd Rapvis
    pyinstaller build.spec
    ```
3.  The output will be in `Rapvis/dist/Rapvis`.

## Creating the Installer

The project uses **Inno Setup** to create the Windows installer.

1.  Install Inno Setup 6.
2.  Open `Rapvis/setup.iss`.
3.  Compile the script.
4.  The `Rapvis_Setup_v0.3.0.exe` will be generated in `Rapvis/` (same folder as `setup.iss`).

## Project Structure

*   `src/`: Source code.
    *   `app.py`: Entry point.
    *   `controller.py`: Logic and orchestration.
    *   `model.py`: Data handling and state.
    *   `view.py`: UI code (using `ttkbootstrap`).
    *   `config_manager.py`: Handles `config.json` and settings.
*   `tests/`: Unit tests.
*   `build.spec`: PyInstaller configuration.
*   `setup.iss`: Inno Setup configuration.
