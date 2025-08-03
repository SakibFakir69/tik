

FROM node:18

# Install Python, pip, ffmpeg, and yt-dlp with error handling
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install

# Copy the rest of the app
COPY . .

# Start the app
CMD ["npm", "start"]