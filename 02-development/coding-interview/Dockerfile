FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY requirements.txt ./
RUN pip3 install --break-system-packages -r requirements.txt
COPY . .
EXPOSE 8000 5173
CMD ["npm", "run", "dev"]
