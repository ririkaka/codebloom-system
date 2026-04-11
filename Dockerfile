# Sử dụng bản ổn định (LTS) để tránh lỗi module
FROM node:20-bookworm-slim

# Cài đặt GCC và các công cụ biên dịch
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Tạo thư mục làm việc
WORKDIR /usr/src/app

# Chỉ copy file package trước để tối ưu build
COPY package*.json ./

# Xóa cache và cài đặt mới hoàn toàn thư viện
RUN npm cache clean --force && npm install

# Copy toàn bộ code còn lại
COPY . .

# Mở cổng 10000
EXPOSE 10000

# Chạy server
CMD ["node", "server.js"]