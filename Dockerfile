FROM node:18

# Install Python, pip, ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg
RUN pip3 install yt-dlp

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install

# Copy the rest of the app
COPY . .

# Start the app
CMD ["npm", "start"]