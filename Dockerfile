# Sử dụng bản ổn định cao
FROM node:20-bookworm-slim

# Cài đặt trình biên dịch GCC cho ngôn ngữ C
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Chỉ copy package.json để cài thư viện trước (tối ưu cache)
COPY package*.json ./

# Ép cài đặt mới hoàn toàn, bỏ qua cache lỗi
RUN npm cache clean --force && npm install

# Copy toàn bộ mã nguồn
COPY . .

# Mở cổng cho Render
EXPOSE 10000

CMD ["node", "server.js"]