# F1 Telemetry Dashboard

A modern, interactive Formula 1 Telemetry Dashboard built with React, Vite, and Chart.js. This application allows you to dive deep into F1 race data, compare driver telemetry, visualize track maps, and analyze lap and sector times.

## Features

- **Live Timing & Leaderboards**: Real-time standings and lap times.
- **Telemetry Comparison**: Compare speed, throttle, brake, and gear data between drivers.
- **Track Map Visualization**: Interactive 3D/2D track maps.
- **Tyre History**: Analyze tyre stints, compounds, and wear over the course of a session.
- **Sector Times**: Detailed breakdown of driver sector times.
- **Weather Panel**: View weather conditions and their impact on track evolution.

## Technology Stack

- **Frontend**: React 19, Vite, Chart.js (react-chartjs-2), Lucide React (for icons)
- **Data Ingestion**: Python (using the `fastf1` library) to fetch telemetry data and store it as JSON.

## Setup & Installation

### 1. Data Ingestion (Python)

To fetch the latest telemetry data, you need to run the data ingestion script. The script downloads telemetry via FastF1 and exports it to the `public/data/` directory.

```bash
# Install required Python dependencies (e.g., fastf1, pandas)
pip install -r requirements.txt  # If available, or install fastf1 directly

# Run the ingestion script
python ingest.py
```

### 2. Frontend Application (Node.js)

Once the data is ingested, you can run the React frontend.

```bash
# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser to view the application.

## Building for Production

To create a production build of the frontend:

```bash
npm run build
```

This will output optimized static assets into the `dist` folder.

## License

This project is licensed under the MIT License.
