# Manual Credit Reports - SpinWheel Integration

A web application for retrieving and displaying credit reports using the SpinWheel API.

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/omarg005/Spinwheel.git
   cd Spinwheel
   ```

2. **Configure your API key**
   - Copy `config.example.js` to `config.js`
   - Open `config.js` and replace `YOUR_API_KEY_HERE` with your actual SpinWheel API key
   - **Important:** `config.js` is gitignored and will not be committed to the repository

3. **Run the application**
   - Option 1: Use Python's built-in server
     ```bash
     python -m http.server 8080
     ```
   - Option 2: Use Node.js http-server
     ```bash
     npx http-server -p 8080
     ```
   - Option 3: Use VS Code Live Server extension
   - Then open `http://localhost:8080` in your browser

## Features

- Client information form with validation
- Knowledge-Based Authentication (KBA) questions
- Credit report retrieval and display
- PDF report generation
- JSON data export

## Security Notes

- Never commit `config.js` to version control
- Keep your API key secure and private
- Use environment-specific configurations for production

## Files

- `index.html` - Main HTML structure
- `app.js` - Application logic and API integration
- `script.js` - Utility functions
- `styles.css` - Styling
- `config.example.js` - Configuration template
- `config.js` - Your actual configuration (gitignored)

## License

Copyright © 2025 Optimal Debt Solutions Inc.

