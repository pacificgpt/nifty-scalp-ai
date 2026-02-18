# Nifty Scalp AI

Nifty Scalp AI is an automated scalping signal generator that processes chart images to identify trading opportunities. It uses Optical Character Recognition (OCR) and image processing algorithms to extract price levels, detect the latest candle, and generate buy/sell signals with defined entry, stop-loss, and take-profit levels.

## Features

-   **Chart Image Processing**: Upload chart images (candlestick charts) for analysis.
-   **Price Level Extraction**: Automatically detects price axis and maps pixels to actual price values using OCR (`tesseract.js`).
-   **Candle Detection**: Identifies the latest candle's high, low, and close prices visually.
-   **Support & Resistance**: Dynamically calculates nearest support and resistance levels.
-   **Signal Generation**: various algorithms to generate high-confidence scalping signals (Buy/Sell) with calculated Risk:Reward ratios.
-   **Visual Annotation**: Returns the original chart annotated with Entry, SL, and TP lines.

## Tech Stack

-   **Runtime**: Node.js
-   **Server**: Express.js
-   **Image Processing**: Jimp, Sharp
-   **OCR**: Tesseract.js
-   **File Handling**: Multer

## Prerequisites

-   Node.js (v14 or higher)
-   npm (Node Package Manager)

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/pacificgpt/nifty-scalp-ai.git
    cd nifty-scalp-ai
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory and add the following:
    ```env
    PORT=3000
    UPLOAD_PATH=public/uploads
    OUTPUT_PATH=public/outputs
    ```
    *Note: Ensure `public/uploads` and `public/outputs` directories exist or are created by the application.*

## Usage

1.  **Start the server**:
    ```bash
    npm start
    # OR for development
    npm run dev
    ```

2.  **Generate a generic scalp signal**:
    Send a `POST` request to `/api/scalp` with a chart image.

    **Using cURL**:
    ```bash
    curl -X POST -F "chart=@/path/to/your/chart_image.png" http://localhost:3000/api/scalp
    ```

    **Response Example**:
    ```json
    {
      "success": true,
      "signal": {
        "action": "BUY",
        "entry": "24350",
        "stopLoss": "24277",
        "target1": "24423",
        "target2": "24496",
        "riskReward": "1:2.00",
        "confidence": 92,
        "strategy": "Iron Fortress Scalp (0.3% move in 5-15 min)",
        "validFor": "Next 15 minutes",
        "note": "Enter only if volume spike + candle close above support"
      },
      "annotatedChart": "/outputs/annotated_chart_image.png",
      "original": "chart_image.png"
    }
    ```

## Project Structure

-   `server.js`: Main application entry point and API route definitions.
-   `utils/imageProcessor.js`: Core logic for image parsing, coordinate mapping, and visual annotation.
-   `utils/scalper.js`: Logic for generating trading signals based on extracted data.
-   `utils/ocr.js`: Helper wrapper around Tesseract.js.
-   `utils/priceMapper.js`: Utility to map Y-coordinates to price values.

## License

ISC