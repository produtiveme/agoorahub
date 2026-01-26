#!/bin/bash
# Script to start the AgooraHub static site

echo "Starting AgooraHub at http://localhost:8000"
echo "Press Ctrl+C to stop"

# Start Python HTTP server
python3 -m http.server 8000
