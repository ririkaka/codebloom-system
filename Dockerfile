# Sử dụng Node.js bản ổn định (LTS) thay vì bản quá mới
FROM node:20-slim

# Cài đặt GCC và các công cụ cần thiết cho C++
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Chỉ copy package.json trước để tận dụng cache của Docker
COPY package*.json ./

# Cài đặt lại từ đầu toàn bộ thư viện
RUN npm cache clean --force
RUN npm install

# Copy toàn bộ code vào
COPY . .

# Mở cổng 10000
EXPOSE 10000

# Chạy server
CMD ["node", "server.js"]